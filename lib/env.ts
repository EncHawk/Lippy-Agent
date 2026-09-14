import { z } from "zod";
const optional = z.preprocess(v => v === "" ? undefined : v, z.string().optional());
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_MODE: z.enum(["google", "development"]).default("google"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  EXTRACTION_PROVIDER: z.enum(["fixture", "brightdata"]).default("fixture"),
  BRIGHTDATA_API_KEY: optional,
  BRIGHTDATA_API_BASE: z.string().url().default("https://api.brightdata.com"),
  BRIGHTDATA_DELIVERY_EMAIL: z.preprocess(v => v === "" ? undefined : v, z.string().email().optional()),
  WORKER_POLL_MS: z.coerce.number().int().min(100).default(1000),
  PROVIDER_POLL_MS: z.coerce.number().int().min(100).default(5000),
  MAX_HEAL_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  RUN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(86400000).default(1800000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});
export const env = envSchema.parse(process.env);
