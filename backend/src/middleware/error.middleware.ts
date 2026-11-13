import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: "The requested endpoint was not found.", errors: [] });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ success: false, message: error.message, errors: error.details });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Request validation failed.",
      errors: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  if (error instanceof multer.MulterError) {
    const status = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" ? 413 : 400;
    res.status(status).json({ success: false, message: "The uploaded file could not be accepted.", errors: [{ code: error.code }] });
    return;
  }
  console.error("Unhandled API error:", error instanceof Error ? error.message : "Unknown error");
  res.status(500).json({ success: false, message: "An unexpected server error occurred.", errors: [] });
};
