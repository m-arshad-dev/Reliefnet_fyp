import { RequestHandler } from 'express';
import * as authService from '../services/auth.service';

// Controllers only translate HTTP <-> service calls. No SQL, no business rules.
export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const data = await authService.login(email, password);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const data = await authService.refresh(refreshToken);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    const data = await authService.me(req.user!.sub);
    res.status(200).json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
};
