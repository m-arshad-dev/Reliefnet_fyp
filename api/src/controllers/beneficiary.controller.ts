import { Request, RequestHandler } from 'express';
import * as beneficiaryService from '../services/beneficiary.service';
import { ForbiddenError } from '../lib/errors';

// Beneficiaries are tenant-owned: pull the NGO from the verified JWT, never the body. A
// global account (system_admin/auditor, ngoId = null) has no tenant to scope to — reject.
// (authorize already blocks them from writes; this is defense in depth.)
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

// POST /beneficiaries — register + duplicate-check + aid_record in one transaction. Always
// 201, even on a cross-NGO hash hit; `data.duplicateFlag` carries the masked identity +
// prior aid (the flag FLAGS, never BLOCKS — humans decide). duplicateFlag is nested INSIDE
// data to keep the strict { success, data, error } envelope (CLAUDE.md law 5).
export const create: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await beneficiaryService.registerBeneficiary(ngoId, req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// POST /beneficiaries/check — pre-check before saving. CROSS-NGO read, no tenant: returns
// the duplicateFlag for a CNIC so a registrar previews it before committing.
export const check: RequestHandler = async (req, res, next) => {
  try {
    const { cnic } = req.body as { cnic: string };
    const data = await beneficiaryService.checkDuplicate(cnic);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /beneficiaries — tenant-scoped list. A tenantless account (system_admin/auditor)
// simply gets an empty page (they oversee elsewhere), so we never 403 a permitted reader.
export const list: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = req.tenant?.ngoId ?? null;
    if (!ngoId) {
      res.status(200).json({ success: true, data: { items: [], nextCursor: null }, error: null });
      return;
    }
    const q = req.query as unknown as { limit?: number; cursor?: string; verified?: boolean };
    const data = await beneficiaryService.listBeneficiaries(ngoId, {
      limit: q.limit,
      cursor: q.cursor,
      verified: q.verified,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// GET /beneficiaries/:id — tenant-scoped detail (404 if cross-tenant).
export const get: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const data = await beneficiaryService.getBeneficiary(ngoId, id);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

// PATCH /beneficiaries/:id/verify — field_coordinator verifies their own NGO's beneficiary.
export const verify: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const data = await beneficiaryService.verifyBeneficiary(ngoId, id, req.user!.sub);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
