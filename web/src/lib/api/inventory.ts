import { api } from './client';
import type { Envelope, Page } from './types';

// Slice 6 Inventory FSM — the FRONTEND source of truth for the inventory vocabulary
// (mirrors the server's inventoryConstants.ts).
export const ITEM_UNITS = ['pack', 'kg', 'litre', 'unit'] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

export const MOVEMENT_STATES = [
  'stock_in',
  'allocated',
  'dispatched',
  'delivered',
  'consumed',
  'correction',
] as const;
export type MovementState = (typeof MOVEMENT_STATES)[number];

// The forward FSM, mirrored so the movement form only offers legal (prevState -> toState)
// pairs as "actions". The server re-validates and is the source of truth.
export interface MovementAction {
  label: string;
  prevState: MovementState | null; // null = entry (stock_in)
  toState: MovementState;
}
export const MOVEMENT_ACTIONS: MovementAction[] = [
  { label: 'Receive (stock in)', prevState: null, toState: 'stock_in' },
  { label: 'Allocate', prevState: 'stock_in', toState: 'allocated' },
  { label: 'Dispatch', prevState: 'allocated', toState: 'dispatched' },
  { label: 'Deliver', prevState: 'dispatched', toState: 'delivered' },
  { label: 'Consume', prevState: 'delivered', toState: 'consumed' },
];

// Item with DERIVED on-hand. quantityOnHand = "available to allocate" (the stock_in balance
// + signed corrections); byState carries the full per-state breakdown. Nothing is a stored
// counter — the server sums movements.
export interface InventoryItem {
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

export interface StockMovement {
  id: string;
  itemId: string;
  quantity: number;
  state: string;
  prevState: string | null;
  correctionNote: string | null;
  movedBy: string;
  createdAt: string;
}

export interface CreateItemInput {
  name: string;
  unit: ItemUnit;
}

export interface CreateMovementInput {
  itemId: string;
  quantity: number;
  toState: MovementState;
  prevState?: MovementState | null;
  correctionNote?: string;
}

export async function listItems(params?: { limit?: number; cursor?: string }): Promise<Page<InventoryItem>> {
  const { data } = await api.get<Envelope<Page<InventoryItem>>>('/inventory/items', { params });
  return data.data;
}

export async function createItem(input: CreateItemInput): Promise<InventoryItem> {
  const { data } = await api.post<Envelope<InventoryItem>>('/inventory/items', input);
  return data.data;
}

export async function listMovements(
  itemId: string,
  params?: { limit?: number; cursor?: string },
): Promise<Page<StockMovement>> {
  const { data } = await api.get<Envelope<Page<StockMovement>>>('/inventory/movements', {
    params: { itemId, ...params },
  });
  return data.data;
}

export async function createMovement(input: CreateMovementInput): Promise<StockMovement> {
  const { data } = await api.post<Envelope<StockMovement>>('/inventory/movements', input);
  return data.data;
}
