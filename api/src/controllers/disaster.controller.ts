import { RequestHandler } from 'express';
import * as disasterService from '../services/disaster.service';

// Controllers only translate HTTP <-> service calls. No SQL, no business rules.
export const create: RequestHandler = async (req, res, next) => {
  try {
    // created_by is the acting system_admin from the verified JWT, never the body.
    const data = await disasterService.createDisaster(req.body, req.user!.sub);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query as { limit?: number; cursor?: string };
    const data = await disasterService.listDisasters({ limit: q.limit, cursor: q.cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const get: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const data = await disasterService.getDisaster(id);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
