import type { Response } from "express";
import type { ApiSuccess } from "../types/index.js";

export function sendSuccess<T>(res: Response, data: T, message: string, status = 200): Response<ApiSuccess<T>> {
  return res.status(status).json({ success: true, message, data });
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
