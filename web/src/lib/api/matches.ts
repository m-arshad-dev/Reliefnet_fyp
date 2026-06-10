import { api } from './client';
import type { Envelope, Page } from './types';
import type { ResourceOffer } from './coordination';

// Slice 4 Matching Loop — the FRONTEND source of truth for the match-status vocabulary,
// mirroring the server's coordinationConstants.ts.
export const MATCH_STATUSES = ['proposed', 'accepted', 'rejected', 'fulfilled'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

// PATCH targets only — 'proposed' is the create-time entry state set by POST /matches.
export type MatchTransitionTarget = 'accepted' | 'rejected' | 'fulfilled';

// One side of a match, denormalized by the server so the card renders self-contained.
export interface MatchSide {
  id: string;
  type: string;
  quantity: number;
  status: string;
  ngoId: string;
  ngoName: string;
  locationId: string | null;
}

export interface Match {
  id: string;
  needId: string;
  offerId: string;
  quantity: number;
  status: string; // proposed | accepted | rejected | fulfilled
  createdBy: string;
  confirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
  need: MatchSide;
  offer: MatchSide;
}

// A candidate IS a shared, available offer from another NGO + two human-decision signals.
export interface Candidate extends ResourceOffer {
  sameRegion: boolean;
  coversQuantity: boolean;
}

export interface CreateMatchInput {
  needId: string;
  offerId: string;
  quantity?: number;
}

export interface ListMatchesQuery {
  disasterId?: string;
  needId?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

// CROSS-NGO suggestions for a need (offers from OTHER NGOs). Suggest-only — never writes.
export async function listCandidates(
  needId: string,
  params?: { locationId?: string; limit?: number; cursor?: string },
): Promise<Page<Candidate>> {
  const { data } = await api.get<Envelope<Page<Candidate>>>(`/needs/${needId}/candidates`, {
    params,
  });
  return data.data;
}

// The human CONFIRM — inserts the match and moves the need + offer in one transaction.
export async function createMatch(input: CreateMatchInput): Promise<Match> {
  const { data } = await api.post<Envelope<Match>>('/matches', input);
  return data.data;
}

export async function listMatches(params: ListMatchesQuery): Promise<Page<Match>> {
  const { data } = await api.get<Envelope<Page<Match>>>('/matches', { params });
  return data.data;
}

export async function setMatchStatus(id: string, status: MatchTransitionTarget): Promise<Match> {
  const { data } = await api.patch<Envelope<Match>>(`/matches/${id}/status`, { status });
  return data.data;
}
