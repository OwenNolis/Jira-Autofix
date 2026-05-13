import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload, UserRole } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'pulse-pre-secret-change-in-production';
export const JWT_EXPIRES = '24h';

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Missing or invalid authorization header' });
    return;
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).auth = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// BR-006: Admin endpoints only accessible for users with role Admin
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    const auth: AuthPayload = (req as any).auth;
    if (auth.role !== 'Admin') {
      res.status(403).json({ message: 'Forbidden — Admin role required' });
      return;
    }
    next();
  });
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const auth: AuthPayload = (req as any).auth;
      if (!roles.includes(auth.role)) {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
      next();
    });
  };
}
