import { RequestHandler } from 'express';
import * as reportService from '../services/report.service';

// Slice 8 — all reads are CROSS-TENANT by design: a coordination dashboard rolls up
// every NGO in a disaster, so these handlers do NOT call requireTenant (mirror
// resourceNeed.controller.list). `reports:read` gates access; the disaster scopes it.
// `disasterId` (and the optional gaps `threshold`) are already validated/coerced by the
// route's Zod schema.

export const heatmap: RequestHandler = async (req, res, next) => {
  try {
    const { disasterId } = req.query as unknown as { disasterId: string };
    const data = await reportService.getHeatmap(disasterId);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const coverageGaps: RequestHandler = async (req, res, next) => {
  try {
    const { disasterId, threshold } = req.query as unknown as {
      disasterId: string;
      threshold?: number;
    };
    const data = await reportService.getCoverageGaps(disasterId, threshold);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const unmatchedNeeds: RequestHandler = async (req, res, next) => {
  try {
    const { disasterId } = req.query as unknown as { disasterId: string };
    const data = await reportService.getUnmatchedNeeds(disasterId);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const resourceAvailability: RequestHandler = async (req, res, next) => {
  try {
    const { disasterId } = req.query as unknown as { disasterId: string };
    const data = await reportService.getResourceAvailability(disasterId);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const threeW: RequestHandler = async (req, res, next) => {
  try {
    const { disasterId } = req.query as unknown as { disasterId: string };
    const data = await reportService.get3WMatrix(disasterId);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
