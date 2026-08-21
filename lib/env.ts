import { z } from "zod";

/**
 * All environment access in the app goes through this module. Nowhere else
 * should call `process.env.X` directly — that keeps the "is this var
 * required, and did we validate it" question answered in exactly one place.
 *
 * API keys are intentionally optional: their absence flips the relevant
 * client into mock mode (see lib/brightdata/client.ts and
 * lib/parallel/client.ts) rather than crashing the app. This is what lets a
 * judge clone the repo and run the full self-heal loop with zero setup.
 */
const envSchema = z.object({
  // Required, no default: a missing DB URL is a boot-time error, never a
  // silent fallback. The value itself lives only in .env.
  DATABASE_URL: z.string().min(1),

  BRIGHTDATA_API_KEY: z.string().optional(),
  BRIGHTDATA_API_BASE: z.string().url().default("https://api.brightdata.com"),

  PARALLEL_API_KEY: z.string().optional(),
  PARALLEL_API_BASE: z.string().url().default("https://api.parallel.ai"),

  WEBHOOK_SIGNING_SECRET: z.string().default("dev-secret-change-me"),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Fail loudly at boot rather than surfacing a cryptic error mid-request.
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration — see logged field errors above.");
  }
  return parsed.data;
}

export const env = loadEnv();

export const isMockBrightData = !env.BRIGHTDATA_API_KEY;
export const isMockParallel = !env.PARALLEL_API_KEY;
