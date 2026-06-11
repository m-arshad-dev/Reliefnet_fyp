import { Request, RequestHandler } from 'express';
import * as campaignService from '../services/campaign.service';
import { ForbiddenError } from '../lib/errors';

// Campaigns are tenant-scoped: pull the NGO from the verified JWT, never the body. A
// global account (system_admin/auditor, ngoId = null) has no tenant to scope to —
// reject rather than guess. (authorize already blocks them; this is defense in depth.)
function requireTenant(req: Request): string {
  const ngoId = req.tenant?.ngoId ?? null;
  if (!ngoId) {
    throw new ForbiddenError('This action requires an NGO-scoped account');
  }
  return ngoId;
}

export const create: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const data = await campaignService.createCampaign(ngoId, req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const q = req.query as { limit?: number; cursor?: string; disasterId?: string };
    const data = await campaignService.listCampaigns(ngoId, {
      limit: q.limit,
      cursor: q.cursor,
      disasterId: q.disasterId,
    });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const setStatus: RequestHandler = async (req, res, next) => {
  try {
    const ngoId = requireTenant(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'active' | 'paused' | 'completed' };
    const data = await campaignService.setCampaignStatus(id, status, ngoId, req.user!.sub);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
