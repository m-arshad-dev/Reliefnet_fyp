/* eslint-disable camelcase */

// Slice 4: Matching Loop (v3 Slice 4). Turns the Slice-3 Coordination Board from
// *visible* into *active*: a human links a candidate offer to a need and drives that
// link to fulfilment, with BOTH sides' statuses moving in lockstep.
//
// resource_matches links one need to one offer. The matching FSM (proposed → accepted →
// fulfilled, with reject from either live state) lives in resourceMatch.service.ts as a
// TRANSITIONS map (CLAUDE.md law 3); status here is plain TEXT with a comment, matching
// the needs/offers convention (no CHECK constraint — legality is enforced in Zod + the
// service). Confirming a match is a MULTI-TABLE transaction (law 4): the service inserts
// the row AND moves the need AND moves the offer inside ONE BEGIN/COMMIT — a half-applied
// match (need=matched but offer=available) must be impossible.
//
// Who drives: the NEEDING NGO's ngo_admin/field_coordinator propose, accept, fulfil, and
// reject; the OFFER's status moves as a CONSEQUENCE (no cross-tenant write path this
// slice). Whole-offer semantics: `quantity` records the agreed amount but an offer is
// reserved→committed→delivered as a unit (partial allocation + stock decrement is Slice 6).
//
// DEFERRED (additive later slices): donor consent (the offering NGO explicitly
// accepting/rejecting — a cross-tenant write + two-party FSM); partial allocation; and RLS
// (Slice 9). FKs resolve against resource_needs/resource_offers (Slice 3) and users
// (Slice 0). Raw SQL via pgm.sql().

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE resource_matches (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      need_id      UUID NOT NULL REFERENCES resource_needs(id),
      offer_id     UUID NOT NULL REFERENCES resource_offers(id),
      quantity     INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'proposed',  -- proposed|accepted|rejected|fulfilled
      created_by   UUID NOT NULL REFERENCES users(id),
      confirmed_by UUID REFERENCES users(id),          -- set when first advanced to 'accepted'
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- Keyset board read (matches involving an NGO), newest first.
    CREATE INDEX idx_matches_keyset ON resource_matches (created_at DESC, id DESC);
    CREATE INDEX idx_matches_need ON resource_matches (need_id);
    CREATE INDEX idx_matches_offer ON resource_matches (offer_id);

    -- DB-level "one LIVE match per need / per offer" — makes a double-match impossible
    -- even under a race; terminal (rejected/fulfilled) rows are excluded so re-matching
    -- after a reject is allowed.
    CREATE UNIQUE INDEX uq_active_match_per_need
      ON resource_matches (need_id)  WHERE status IN ('proposed', 'accepted');
    CREATE UNIQUE INDEX uq_active_match_per_offer
      ON resource_matches (offer_id) WHERE status IN ('proposed', 'accepted');
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS resource_matches;
  `);
};
