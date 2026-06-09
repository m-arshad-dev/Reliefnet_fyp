import { RequestHandler } from 'express';
import * as ngoService from '../services/ngo.service';

// Controllers only translate HTTP <-> service calls. No SQL, no business rules.
export const register: RequestHandler = async (req, res, next) => {
  try {
    const data = await ngoService.registerNgo(req.body);
    res.status(201).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const list: RequestHandler = async (req, res, next) => {
  try {
    const q = req.query as { limit?: number; cursor?: string };
    const data = await ngoService.listNgos({ limit: q.limit, cursor: q.cursor });
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const setStatus: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'active' | 'suspended' };
    const data = await ngoService.setNgoStatus(id, status, req.user!.sub);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
