import type { Request } from "express";

export type AppRole = "admin" | "customer";

export type AuthUser = {
  id: string;
  email?: string;
  role: AppRole;
};

export type AuthenticatedRequest = Request & {
  user?: AuthUser;
};

export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  errors: unknown[];
};
