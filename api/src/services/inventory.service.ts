import * as itemRepo from '../repositories/inventoryItem.repository';
import type { ItemRow, ItemWithStockRow } from '../repositories/inventoryItem.repository';
import * as movementRepo from '../repositories/stockMovement.repository';
import type { MovementRow } from '../repositories/stockMovement.repository';
import { withTenant } from '../db/pool';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';
import type { MovementState } from '../lib/inventoryConstants';

// ── The inventory FSM (CLAUDE.md law 3) ─────────────────────────────────────────────────
// The forward chain. recordMovement rejects any (prev_state → state) not in this map (422).
// 'stock_in' is the entry state (its only legal prev_state is NULL); 'consumed' is terminal.
// 'correction' is intentionally NOT here — it's the special append-only branch handled
// inline below (ngo_admin-only + mandatory note), never a forward transition target.
const INVENTORY_TRANSITIONS: Record<string, string[]> = {
  stock_in: ['allocated'],
  allocated: ['dispatched'],
  dispatched: ['delivered'],
  delivered: ['consumed'],
  consumed: [],
};

// Client-safe item projection (camelCase). `quantityOnHand` is the headline derived number
// = the 'stock_in' balance + signed corrections ("available to allocate"). `byState` carries
// the full per-state breakdown so the picture is unambiguous. All of it is DERIVED by
// summing movements — there is no stored counter.
export interface PublicItem {
  id: string;
  ngoId: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  byState: {
    stockIn: number;
    allocated: number;
    dispatched: number;
    delivered: number;
    consumed: number;
  };
  createdAt: string;
  updatedAt: string;
}

function toPublicItem(row: ItemWithStockRow): PublicItem {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    name: row.name,
    unit: row.unit,
    quantityOnHand: row.in_stock,
    byState: {
      stockIn: row.in_stock,
      allocated: row.allocated,
      dispatched: row.dispatched,
      delivered: row.delivered,
      consumed: row.consumed,
    },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// A freshly-created item has no movements yet, so every balance is 0. listByNgoWithStock
// derives these for real; createItem returns this projection so the response shape matches.
function toFreshPublicItem(row: ItemRow): PublicItem {
  return {
    id: row.id,
    ngoId: row.ngo_id,
    name: row.name,
    unit: row.unit,
    quantityOnHand: 0,
    byState: { stockIn: 0, allocated: 0, dispatched: 0, delivered: 0, consumed: 0 },
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface PublicMovement {
  id: string;
  itemId: string;
  quantity: number;
  state: string;
  prevState: string | null;
  correctionNote: string | null;
  movedBy: string;
  createdAt: string;
}

function toPublicMovement(row: MovementRow): PublicMovement {
  return {
    id: row.id,
    itemId: row.item_id,
    quantity: row.quantity,
    state: row.state,
    prevState: row.prev_state,
    correctionNote: row.correction_note,
    movedBy: row.moved_by,
    createdAt: row.created_at.toISOString(),
  };
}

// POST /inventory/items — tenant-owned (ngo_id forced from the JWT, never the body).
export async function createItem(
  tenantNgoId: string,
  input: { name: string; unit: string },
  actorId: string,
): Promise<PublicItem> {
  void actorId; // recorded as moved_by once stock arrives; the item row itself has no actor
  const row = await withTenant(tenantNgoId, (client) =>
    itemRepo.insert({ ngoId: tenantNgoId, name: input.name, unit: input.unit }, client),
  );
  return toFreshPublicItem(row);
}

// GET /inventory/items — tenant-scoped keyset page, each item with DERIVED on-hand.
export async function listItems(
  tenantNgoId: string,
  opts: { limit?: number; cursor?: string },
): Promise<Page<PublicItem>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  const rows = await withTenant(tenantNgoId, (client) =>
    itemRepo.listByNgoWithStock(tenantNgoId, { limit, cursor }, client),
  );
  return buildPage(rows, limit, toPublicItem);
}

interface RecordMovementInput {
  itemId: string;
  quantity: number;
  toState: MovementState;
  prevState?: string | null;
  correctionNote?: string;
}

interface Actor {
  id: string;
  role: string;
}

// THE CRUX OF THE SLICE (laws 3 & 4). One withTransaction: lock the item, validate the FSM
// (or the correction guard), check derived availability, then append ONE immutable row.
// `tenantNgoId` is the caller's NGO from the JWT — the item must belong to it (404 otherwise,
// never reveal another tenant's item). The FOR-UPDATE lock serializes concurrent movements
// on the same item so the availability check can't be raced.
export async function recordMovement(
  tenantNgoId: string,
  input: RecordMovementInput,
  actor: Actor,
): Promise<PublicMovement> {
  return withTenant(tenantNgoId, async (client) => {
    const item = await itemRepo.findByIdForUpdate(input.itemId, client);
    if (!item || item.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Inventory item not found');
    }

    const { toState, quantity } = input;
    let prevState: string | null;
    let correctionNote: string | null = null;

    if (toState === 'correction') {
      // Special append-only branch — enforced IN THE SERVICE, not just middleware (law 3).
      // Only ngo_admin may issue corrections (the inventory:correct permission is ngo_admin-
      // only; this is the authoritative guard). 403 otherwise.
      if (actor.role !== 'ngo_admin') {
        throw new ForbiddenError('Only an NGO admin may issue inventory corrections');
      }
      const note = input.correctionNote?.trim();
      if (!note) {
        throw new ValidationError('correction_note is required for a correction');
      }
      // Corrections are signed adjustments to the available pool — any nonzero amount
      // (negative to write stock off, positive to add it back).
      if (!Number.isFinite(quantity) || quantity === 0) {
        throw new ValidationError('Correction quantity must be a nonzero number');
      }
      correctionNote = note;
      // prev_state on a correction is advisory (which state was wrong); accept it if it's a
      // known forward state, otherwise drop it — it never drives the FSM.
      prevState =
        input.prevState && input.prevState in INVENTORY_TRANSITIONS ? input.prevState : null;
    } else if (toState === 'stock_in') {
      // The entry point: injects new stock. No prev_state; quantity must be positive.
      if (input.prevState != null) {
        throw new ValidationError("'stock_in' is the entry state; omit prevState");
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ValidationError('Quantity must be a positive number');
      }
      prevState = null;
    } else {
      // Forward move. prev_state is required and (prev_state → toState) must be in the map.
      const from = input.prevState;
      if (!from) {
        throw new ValidationError('prevState is required for this movement');
      }
      const allowed = INVENTORY_TRANSITIONS[from] ?? [];
      if (!allowed.includes(toState)) {
        throw new ValidationError(
          `Illegal inventory transition from '${from}' to '${toState}'`,
        );
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new ValidationError('Quantity must be a positive number');
      }
      // Derived availability: you can't move more than what currently sits in `from`.
      const available = await movementRepo.availableInState(input.itemId, from, client);
      if (quantity > available) {
        throw new ValidationError(
          `Insufficient quantity in '${from}' (available ${available}, requested ${quantity})`,
        );
      }
      prevState = from;
    }

    const inserted = await movementRepo.insert(
      {
        ngoId: tenantNgoId,
        itemId: input.itemId,
        quantity,
        state: toState,
        prevState,
        correctionNote,
        movedBy: actor.id,
      },
      client,
    );
    return toPublicMovement(inserted);
  });
}

// GET /inventory/movements?itemId= — an item's append-only history. The item must belong to
// the caller's NGO (404 otherwise) before we expose any movements.
export async function listMovements(
  tenantNgoId: string,
  itemId: string,
  opts: { limit?: number; cursor?: string },
): Promise<Page<PublicMovement>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  return withTenant(tenantNgoId, async (client) => {
    const item = await itemRepo.findById(itemId, client);
    if (!item || item.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Inventory item not found');
    }
    const rows = await movementRepo.listByItem(itemId, { limit, cursor }, client);
    return buildPage(rows, limit, toPublicMovement);
  });
}
