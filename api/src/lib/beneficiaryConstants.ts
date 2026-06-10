// Slice 5 Beneficiaries — the backend source of truth for the aid vocabulary. The
// beneficiary routes build their Zod `z.enum(...)` from this tuple so the aid-type
// vocabulary is written down exactly ONCE on the server (mirrors coordinationConstants.ts).

// Categories of aid recorded against a beneficiary (v2 §4.4 aid_records.aid_type). Distinct
// from RESOURCE_TYPES (the needs/offers vocabulary) — aid records describe what was
// delivered to a person, not what's traded on the coordination board.
export const AID_TYPES = ['food', 'shelter', 'medical', 'hygiene', 'other'] as const;
export type AidType = (typeof AID_TYPES)[number];
