import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/index.js";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if ((req as AuthenticatedRequest).user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Administrator access is required.", errors: [] });
  }
  return next();
}
