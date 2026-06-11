import { RequestHandler } from 'express';
import * as auditService from '../services/audit.service';

// Slice 10 — audit ledger reads are OVERSIGHT, not tenant-scoped: auditor + system_admin see
// the whole global chain, so these handlers do NOT call requireTenant (mirror the cross-tenant
// report.controller). `audit:read` gates access at the route. Query params (entityType,
// actorId, limit, cursor) are validated/coerced by the route's Zod schema.

export const listLedger: RequestHandler = async (req, res, next) => {
  try {
    const { entityType, actorId, limit, cursor } = req.query as unknown as {
      entityType?: string;
      actorId?: string;
      limit?: number;
      cursor?: string;
    };
    const data = await auditService.listLedger({ entityType, actorId, limit, cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const verify: RequestHandler = async (_req, res, next) => {
  try {
    const data = await auditService.verifyChain();
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
