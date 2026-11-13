import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function validateUuidParam(parameter = "id") {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = z.object({ [parameter]: z.string().uuid() }).safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "Invalid resource identifier.", errors: [] });
    }
    return next();
  };
}
