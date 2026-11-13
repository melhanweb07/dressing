import type { Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { supabase } from "../config/supabase.js";
import type { AuthenticatedRequest } from "../types/index.js";
import { AppError } from "../utils/errors.js";
import { sendSuccess } from "../utils/http.js";

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) throw new AppError(401, "Email or password is incorrect.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin") {
    await authClient.auth.signOut({ scope: "local" });
    throw new AppError(403, "Administrator access is required.");
  }
  return sendSuccess(res, {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email, role: "admin" },
  }, "Signed in successfully.");
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken: string };
  const authClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session || !data.user) throw new AppError(401, "The session could not be refreshed.");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (profile?.role !== "admin") throw new AppError(403, "Administrator access is required.");
  return sendSuccess(res, {
    token: data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresAt: data.session.expires_at,
    user: { id: data.user.id, email: data.user.email, role: "admin" },
  }, "Session refreshed successfully.");
}

export async function logout(req: Request, res: Response) {
  const authReq = req as AuthenticatedRequest;
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !authReq.user) throw new AppError(401, "Authentication is required.");
  const { error } = await supabase.auth.admin.signOut(token);
  if (error) throw new AppError(401, "The session could not be revoked.");
  return sendSuccess(res, null, "Signed out successfully.");
}

export async function session(req: Request, res: Response) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new AppError(401, "Authentication is required.");
  return sendSuccess(res, { user }, "Session is valid.");
}
