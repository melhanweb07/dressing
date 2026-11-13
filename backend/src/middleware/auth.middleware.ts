import type { NextFunction, Request, Response } from "express";
import { supabase, supabaseAuth } from "../config/supabase.js";
import type { AppRole, AuthenticatedRequest } from "../types/index.js";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: "Authentication is required.", errors: [] });
  }

  const { data: userData, error: authError } = await supabaseAuth.auth.getUser(match[1]);
  if (authError || !userData.user) {
    return res.status(401).json({ success: false, message: "Your session is invalid or has expired.", errors: [] });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) return next(profileError);
  if (!profile || !["admin", "customer"].includes(profile.role)) {
    return res.status(403).json({ success: false, message: "Your account has no store role.", errors: [] });
  }

  (req as AuthenticatedRequest).user = {
    id: userData.user.id,
    email: userData.user.email,
    role: profile.role as AppRole,
  };
  return next();
}
