// Keyset (cursor) pagination helpers — CLAUDE.md law 5: keyset, never OFFSET.
// Lists order by (created_at DESC, id DESC); the cursor is the last row's
// (created_at, id) pair, opaquely base64url-encoded so clients treat it as a token.

export interface Keyset {
  createdAt: string; // ISO 8601 timestamptz
  id: string; // uuid tiebreaker
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function clampLimit(limit: number | undefined): number {
  if (!limit || limit < 1) return DEFAULT_LIMIT;
  return Math.min(limit, MAX_LIMIT);
}

export function encodeCursor(k: Keyset): string {
  return Buffer.from(`${k.createdAt}|${k.id}`).toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): Keyset | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const sep = decoded.lastIndexOf('|');
    if (sep === -1) return null;
    return { createdAt: decoded.slice(0, sep), id: decoded.slice(sep + 1) };
  } catch {
    return null;
  }
}

// Turn a page of DB rows into { items, nextCursor }. When a full `limit` rows came
// back, the last row's keyset becomes the next cursor; otherwise we're at the end.
export function buildPage<Row extends { created_at: Date; id: string }, Out>(
  rows: Row[],
  limit: number,
  project: (row: Row) => Out,
): Page<Out> {
  const items = rows.map(project);
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === limit && last
      ? encodeCursor({ createdAt: last.created_at.toISOString(), id: last.id })
      : null;
  return { items, nextCursor };
}
