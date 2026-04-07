import type { Request, Response, NextFunction } from "express";
import { verifyToken, extractBearerToken } from "../lib/jwt";

export function getUserId(req: Request): string | null {
  const token = extractBearerToken(req.headers.authorization);
  if (token) {
    return verifyToken(token);
  }
  return (req.session as any)?.userId ?? null;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as any).userId = userId;
  next();
}
