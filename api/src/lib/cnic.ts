import { createHash } from 'node:crypto';
import { env } from '../config/env';

// Slice 5: privacy-preserving beneficiary identity. A raw CNIC is NEVER stored or logged.
// It is reduced to a one-way SHA-256 hash, salted with a server-side secret pepper so the
// hash cannot be brute-forced from the (small, structured) CNIC space without the pepper.
// The hex digest lands in beneficiaries.cnic_hash / aid_records.cnic_hash; the shared
// cnic_hash index is the only cross-tenant read seam for duplicate detection (v2 §4.4).

// Strip every non-digit (a CNIC is 13 digits, typically typed `12345-1234567-1`) so the
// same person hashes identically regardless of dashes/spaces.
export function normalizeCnic(raw: string): string {
  return raw.replace(/\D/g, '');
}

// normalize -> prepend the secret pepper -> SHA-256 -> 64-char hex. CNIC_PEPPER is a real
// deploy secret (Railway), never committed. Never log the raw CNIC or the pepper.
export function hashCnic(raw: string): string {
  const normalized = normalizeCnic(raw);
  return createHash('sha256').update(env.CNIC_PEPPER + normalized).digest('hex');
}

// Masked identity for the duplicate-flag banner — derived from the just-submitted CNIC at
// request time (we hold the raw value only for the duration of the request), NEVER
// persisted. Reveals the last 2 digits, masks the rest (e.g. `***********91`).
export function maskCnic(raw: string): string {
  const normalized = normalizeCnic(raw);
  if (normalized.length < 2) return '****';
  return `${'*'.repeat(normalized.length - 2)}${normalized.slice(-2)}`;
}
