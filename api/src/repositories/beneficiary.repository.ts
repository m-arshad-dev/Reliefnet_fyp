import { PoolClient } from 'pg';
import { query } from '../db/pool';
import type { Keyset } from '../lib/pagination';

// The shape of a row in the `beneficiaries` table (snake_case, straight from SQL).
// cnic_hash is included for internal use (the service needs it to write the aid_record)
// but is NEVER projected to the client — toPublicBeneficiary drops it.
export interface BeneficiaryRow {
  id: string;
  ngo_id: string;
  cnic_hash: string;
  full_name: string;
  household_size: number | null;
  location_id: string | null;
  contact_masked: string | null;
  verified: boolean;
  verified_by: string | null;
  registered_by: string;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id, ngo_id, cnic_hash, full_name, household_size, location_id,
                 contact_masked, verified, verified_by, registered_by,
                 created_at, updated_at`;

interface InsertBeneficiaryParams {
  ngoId: string;
  cnicHash: string;
  fullName: string;
  householdSize: number | null;
  locationId: string | null;
  contactMasked: string | null;
  registeredBy: string;
}

// Step 2 of the registration transaction (after the cross-NGO prior-aid read, before the
// aid_record insert). Always called with the shared `client` so the whole write is atomic.
export async function insert(
  params: InsertBeneficiaryParams,
  client?: PoolClient,
): Promise<BeneficiaryRow> {
  const text = `INSERT INTO beneficiaries
                  (ngo_id, cnic_hash, full_name, household_size, location_id, contact_masked, registered_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING ${COLUMNS}`;
  const values = [
    params.ngoId,
    params.cnicHash,
    params.fullName,
    params.householdSize,
    params.locationId,
    params.contactMasked,
    params.registeredBy,
  ];
  const { rows } = client
    ? await client.query<BeneficiaryRow>(text, values)
    : await query<BeneficiaryRow>(text, values);
  return rows[0];
}

export async function findById(id: string, client?: PoolClient): Promise<BeneficiaryRow | null> {
  const text = `SELECT ${COLUMNS} FROM beneficiaries WHERE id = $1`;
  const { rows } = client
    ? await client.query<BeneficiaryRow>(text, [id])
    : await query<BeneficiaryRow>(text, [id]);
  return rows[0] ?? null;
}

// Locked FOR UPDATE — used inside the verify transaction so two concurrent verifies can't
// race past the "already verified" guard.
export async function findByIdForUpdate(
  id: string,
  client: PoolClient,
): Promise<BeneficiaryRow | null> {
  const { rows } = await client.query<BeneficiaryRow>(
    `SELECT ${COLUMNS} FROM beneficiaries WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0] ?? null;
}

export async function setVerified(
  id: string,
  verifiedBy: string,
  client: PoolClient,
): Promise<BeneficiaryRow> {
  const { rows } = await client.query<BeneficiaryRow>(
    `UPDATE beneficiaries
     SET verified = true, verified_by = $2, updated_at = now()
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, verifiedBy],
  );
  return rows[0];
}

// Tenant-scoped keyset page: only beneficiaries belonging to `ngoId` (the app-layer
// isolation guarantee for this slice; DB-enforced RLS lands in Slice 9). Optional
// `verified` filter. Conditions/params assembled positionally — raw, parameterized SQL.
export async function listByNgo(
  ngoId: string,
  opts: { limit: number; cursor?: Keyset | null; verified?: boolean },
  client?: PoolClient,
): Promise<BeneficiaryRow[]> {
  const { limit, cursor, verified } = opts;
  const conditions: string[] = ['ngo_id = $1'];
  const values: unknown[] = [ngoId];

  if (verified !== undefined) {
    values.push(verified);
    conditions.push(`verified = $${values.length}`);
  }
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(`(created_at, id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  values.push(limit);
  const limitPos = values.length;

  const text = `SELECT ${COLUMNS} FROM beneficiaries
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC, id DESC
     LIMIT $${limitPos}`;
  const { rows } = client
    ? await client.query<BeneficiaryRow>(text, values)
    : await query<BeneficiaryRow>(text, values);
  return rows;
}
