import * as matchRepo from '../repositories/resourceMatch.repository';
import type { MatchRow } from '../repositories/resourceMatch.repository';
import * as needRepo from '../repositories/resourceNeed.repository';
import * as offerRepo from '../repositories/resourceOffer.repository';
import { toPublicOffer, type PublicOffer } from './resourceOffer.service';
import { withCrossTenant, withTenantShared } from '../db/pool';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  isUniqueViolation,
} from '../lib/errors';
import { buildPage, clampLimit, decodeCursor, type Page } from '../lib/pagination';
import type { MatchTransitionTarget } from '../lib/coordinationConstants';

// ── The match FSM (CLAUDE.md law 3) ─────────────────────────────────────────────────
// The service rejects any (from → to) not in this map. 'proposed' is the create-time
// entry state (set by POST /matches); 'rejected'/'fulfilled' are terminal.
const MATCH_TRANSITIONS: Record<string, string[]> = {
  proposed: ['accepted', 'rejected'],
  accepted: ['fulfilled', 'rejected'],
  rejected: [],
  fulfilled: [],
};

// Every match status implies a (need, offer) status. This mapping table is THE authority
// for need/offer status movement — applied in the SAME transaction as the match write, so
// the three rows can never drift out of lockstep. 'proposed' is applied on insert; the
// PATCH targets are applied on transition. Reject releases both sides.
const MATCH_EFFECT: Record<string, { need: string; offer: string }> = {
  proposed: { need: 'matched', offer: 'reserved' },
  accepted: { need: 'fulfilling', offer: 'committed' },
  fulfilled: { need: 'fulfilled', offer: 'delivered' },
  rejected: { need: 'open', offer: 'available' },
};

// Client-safe match projection (camelCase) with both sides nested so the card is
// self-contained: "NGO A's need ↔ NGO B's offer, status=fulfilling".
export interface PublicMatch {
  id: string;
  needId: string;
  offerId: string;
  quantity: number;
  status: string;
  createdBy: string;
  confirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
  need: {
    id: string;
    type: string;
    quantity: number;
    status: string;
    ngoId: string;
    ngoName: string;
    locationId: string | null;
  };
  offer: {
    id: string;
    type: string;
    quantity: number;
    status: string;
    ngoId: string;
    ngoName: string;
    locationId: string | null;
  };
}

function toPublicMatch(row: MatchRow): PublicMatch {
  return {
    id: row.id,
    needId: row.need_id,
    offerId: row.offer_id,
    quantity: row.quantity,
    status: row.status,
    createdBy: row.created_by,
    confirmedBy: row.confirmed_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    need: {
      id: row.need_id,
      type: row.need_type,
      quantity: row.need_quantity,
      status: row.need_status,
      ngoId: row.need_ngo_id,
      ngoName: row.need_ngo_name,
      locationId: row.need_location_id,
    },
    offer: {
      id: row.offer_id,
      type: row.offer_type,
      quantity: row.offer_quantity,
      status: row.offer_status,
      ngoId: row.offer_ngo_id,
      ngoName: row.offer_ngo_name,
      locationId: row.offer_location_id,
    },
  };
}

// A candidate IS a shared, available offer from another NGO, plus two human-decision
// signals computed against the need (so the UI can badge without changing keyset order).
export interface PublicCandidate extends PublicOffer {
  sameRegion: boolean;
  coversQuantity: boolean;
}

// SUGGEST-only (no write): given a need, return shared/available offers from OTHER NGOs
// that match on disaster + type, newest first, keyset-paginated. `sameRegion`/
// `coversQuantity` are advisory flags — a human still confirms (flag, don't force).
export async function getCandidates(
  needId: string,
  opts: { locationId?: string; limit?: number; cursor?: string },
): Promise<Page<PublicCandidate>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);

  // Pure cross-tenant suggestion: resolve the need (board_read) then the other NGOs' shared
  // offers (shared_read) in one cross-tenant txn — no tenant id, the flag grants the reads.
  const { need, rows } = await withCrossTenant(async (client) => {
    const found = await needRepo.findById(needId, client);
    if (!found) throw new NotFoundError('Need not found');
    const offers = await offerRepo.findCandidateOffersForNeed(
      { disasterId: found.disaster_id, type: found.type, ngoId: found.ngo_id },
      { locationId: opts.locationId, limit, cursor },
      client,
    );
    return { need: found, rows: offers };
  });

  return buildPage(rows, limit, (row) => {
    const offer = toPublicOffer(row);
    return {
      ...offer,
      sameRegion: need.location_id != null && offer.locationId === need.location_id,
      coversQuantity: offer.quantity >= need.quantity,
    };
  });
}

interface ProposeMatchInput {
  needId: string;
  offerId: string;
  quantity?: number;
}

// THE CRUX (laws 3 & 4). One withTransaction inserts the match AND moves the need AND
// moves the offer — all succeed or all roll back. `tenantNgoId` is the caller's NGO from
// the JWT: only the NEEDING NGO drives, so the need must belong to it (404 otherwise —
// never reveal another NGO's need). The offer's status moves as a CONSEQUENCE (no
// cross-tenant write path — donor consent is a deferred, additive slice). Rows are locked
// FOR UPDATE (need → offer) so two concurrent proposes can't race; the partial-unique
// index is the DB-level backstop.
export async function proposeMatch(
  tenantNgoId: string,
  input: ProposeMatchInput,
  actorId: string,
): Promise<PublicMatch> {
  // withTenantShared: tenant GUC scopes our own need (tenant_rw) and the match insert
  // (WITH CHECK needing-side); the cross_tenant flag opens the counterparty's SHARED offer
  // for both the FOR UPDATE lock and the status write (shared_read + shared_match_write).
  return withTenantShared(tenantNgoId, async (client) => {
    const need = await needRepo.findByIdForUpdate(input.needId, client);
    if (!need || need.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Need not found');
    }
    if (need.status !== 'open') {
      throw new ConflictError('This need is no longer open for matching');
    }

    const offer = await offerRepo.findByIdForUpdate(input.offerId, client);
    // 'private' offers are never exposed cross-tenant, so treat them as not found here.
    if (!offer || offer.visibility !== 'shared') {
      throw new NotFoundError('Offer not found');
    }
    if (offer.status !== 'available') {
      throw new ConflictError('This offer is no longer available');
    }
    if (offer.disaster_id !== need.disaster_id) {
      throw new ValidationError('Offer belongs to a different disaster');
    }
    if (offer.type !== need.type) {
      throw new ValidationError('Offer resource type does not match the need');
    }
    if (offer.ngo_id === need.ngo_id) {
      throw new ValidationError('Cannot match your own offer');
    }

    const quantity = input.quantity ?? need.quantity;
    if (quantity < 1 || quantity > offer.quantity) {
      throw new ValidationError('Match quantity must be between 1 and the offered quantity');
    }

    let inserted: MatchRow;
    try {
      inserted = await matchRepo.insert(
        { needId: need.id, offerId: offer.id, quantity, createdBy: actorId },
        client,
      );
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('A live match already exists for this need or offer');
      }
      throw err;
    }

    const effect = MATCH_EFFECT.proposed;
    await needRepo.updateStatus(need.id, effect.need, client);
    await offerRepo.updateStatus(offer.id, effect.offer, client);

    // Re-hydrate AFTER the status moves so the response carries the fresh need/offer
    // statuses (matched/reserved), not the pre-update ones the insert's join captured.
    const hydrated = await matchRepo.findByIdHydrated(inserted.id, client);
    return toPublicMatch(hydrated ?? inserted);
  });
}

// Advance/reject a match. Same multi-table-transaction discipline as propose: the match
// status moves AND the need/offer statuses move in lockstep, all in one BEGIN/COMMIT. Only
// the needing NGO transitions (need.ngo_id must equal the caller's NGO). Lock order
// (need → offer → match) is consistent with propose to stay deadlock-free.
export async function transitionMatch(
  tenantNgoId: string,
  matchId: string,
  toStatus: MatchTransitionTarget,
  actorId: string,
): Promise<PublicMatch> {
  // Same dual-GUC seam as proposeMatch: own need (tenant_rw) + counterparty shared offer
  // (shared_match_write) move in lockstep; the match row resolves via either-parent tenant_rw.
  return withTenantShared(tenantNgoId, async (client) => {
    const match = await matchRepo.findByIdForUpdate(matchId, client);
    if (!match) throw new NotFoundError('Match not found');

    const need = await needRepo.findByIdForUpdate(match.need_id, client);
    const offer = await offerRepo.findByIdForUpdate(match.offer_id, client);
    if (!need || need.ngo_id !== tenantNgoId) {
      throw new NotFoundError('Match not found');
    }
    if (!offer) throw new NotFoundError('Offer not found');

    const allowed = MATCH_TRANSITIONS[match.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new ValidationError(
        `Cannot change match status from '${match.status}' to '${toStatus}'`,
      );
    }

    const effect = MATCH_EFFECT[toStatus];
    await needRepo.updateStatus(need.id, effect.need, client);
    await offerRepo.updateStatus(offer.id, effect.offer, client);

    // Stamp who confirmed only on the first human confirmation (the move to 'accepted').
    const confirmedBy = toStatus === 'accepted' ? actorId : null;
    const updated = await matchRepo.updateStatus(matchId, toStatus, confirmedBy, client);
    return toPublicMatch(updated);
  });
}

// TENANT-SCOPED list: matches the caller's NGO participates in (needing OR offering side).
export async function listMatches(
  tenantNgoId: string,
  opts: { disasterId?: string; needId?: string; status?: string; limit?: number; cursor?: string },
): Promise<Page<PublicMatch>> {
  const limit = clampLimit(opts.limit);
  const cursor = decodeCursor(opts.cursor);
  // withTenantShared: the app-layer filter (rn.ngo_id=$1 OR ro.ngo_id=$1) scopes to matches
  // we're part of, but each row's INNER JOINs reach the COUNTERPARTY's need/offer — the
  // cross_tenant flag (board_read + shared_read) lets those JOINs resolve so both sides see it.
  const rows = await withTenantShared(tenantNgoId, (client) =>
    matchRepo.listInvolvingNgo(
      tenantNgoId,
      { disasterId: opts.disasterId, needId: opts.needId, status: opts.status, limit, cursor },
      client,
    ),
  );
  return buildPage(rows, limit, toPublicMatch);
}
