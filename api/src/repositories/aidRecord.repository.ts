import { PoolClient } from 'pg';
import { query } from '../db/pool';

// The shape of an aid_records row (snake_case, straight from SQL).
export interface AidRecordRow {
  id: string;
  beneficiary_id: string;
  cnic_hash: string;
  ngo_id: string;
  campaign_id: string;
  aid_type: string;
  delivered_at: Date;
  recorded_by: string;
}

// A prior-aid hit for the duplicate flag — the aid_type + when, plus the NGO's NAME (so
// the banner reads "Already aided by NGO-B"). Joined from ngos.
export interface PriorAidRow {
  ngo_name: string;
  aid_type: string;
  delivered_at: Date;
}

interface InsertAidRecordParams {
  beneficiaryId: string;
  cnicHash: string;
  ngoId: string;
  campaignId: string;
  aidType: string;
  recordedBy: string;
}

// Step 3 of the registration transaction (after the beneficiary insert). Always called
// with the shared `client` so create + flag-read + aid_record are one atomic write.
export async function insert(
  params: InsertAidRecordParams,
  client?: PoolClient,
): Promise<AidRecordRow> {
  const text = `INSERT INTO aid_records
                  (beneficiary_id, cnic_hash, ngo_id, campaign_id, aid_type, recorded_by)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`;
  const values = [
    params.beneficiaryId,
    params.cnicHash,
    params.ngoId,
    params.campaignId,
    params.aidType,
    params.recordedBy,
  ];
  const { rows } = client
    ? await client.query<AidRecordRow>(text, values)
    : await query<AidRecordRow>(text, values);
  return rows[0];
}

// THE CROSS-NGO SEAM (v2 §4.4). Reads every aid_record for a cnic_hash regardless of NGO —
// deliberately NO ngo_id filter, so a person aided by ANY NGO surfaces. This is the only
// cross-tenant read in the slice and is kept in its own clearly-named function, separate
// from the tenant-scoped queries, so the Slice-9 RLS carve-out has a single seam to grant
// (mirrors the coordination board's cross-NGO candidate read). Newest aid first; capped.
export async function findPriorAidByHash(
  cnicHash: string,
  client?: PoolClient,
): Promise<PriorAidRow[]> {
  const text = `SELECT n.name AS ngo_name, ar.aid_type, ar.delivered_at
                FROM aid_records ar
                JOIN ngos n ON n.id = ar.ngo_id
                WHERE ar.cnic_hash = $1
                ORDER BY ar.delivered_at DESC
                LIMIT 10`;
  const { rows } = client
    ? await client.query<PriorAidRow>(text, [cnicHash])
    : await query<PriorAidRow>(text, [cnicHash]);
  return rows;
}
