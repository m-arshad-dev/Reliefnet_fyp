// Shared API envelope + keyset-page shapes (mirrors the server's { success, data,
// error } and { items, nextCursor } contracts).
export interface Envelope<T> {
  success: boolean;
  data: T;
  error: { code: string; message: string } | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
