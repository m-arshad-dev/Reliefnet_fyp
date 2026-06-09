import { RequestHandler } from 'express';
import * as locationService from '../services/location.service';

// Reference data for region pickers — readable by any authenticated user. Controllers
// only translate HTTP <-> service calls. No SQL, no business rules.
export const list: RequestHandler = async (_req, res, next) => {
  try {
    const data = await locationService.listLocations();
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
