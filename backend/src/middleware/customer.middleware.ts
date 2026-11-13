import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../types/index.js";

export function requireCustomer(req: Request, res: Response, next: NextFunction) {
  const role = (req as AuthenticatedRequest).user?.role;
  if (role !== "customer") {
    return res.status(403).json({ success: false, message: "Customer access is required.", errors: [] });
  }
  return next();
}
