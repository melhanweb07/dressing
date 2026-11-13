import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  API_BASE_PATH: z.string().regex(/^\/[a-zA-Z0-9/_-]*$/).default("/api"),
  FRONTEND_ORIGINS: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default("store-assets"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(150),
  ORDER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(5 * 1024 * 1024).default(5 * 1024 * 1024),
  MAX_REQUEST_BYTES: z.string().default("1mb"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid backend environment: ${details}`);
}

export const env = {
  ...parsed.data,
  frontendOrigins: parsed.data.FRONTEND_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
};
