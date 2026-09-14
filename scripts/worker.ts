import { env } from "../lib/env";
import { db } from "../lib/db";
import { tick } from "../lib/jobs/worker";
async function main() {
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  console.info(JSON.stringify({ event: "worker.started", provider: env.EXTRACTION_PROVIDER }));
  try {
    while (!stopping) {
      try { if (await tick()) continue; } catch (error) { console.error("Worker tick failed", error); }
      await new Promise(resolve => setTimeout(resolve, env.WORKER_POLL_MS));
    }
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
