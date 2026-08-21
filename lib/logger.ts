/**
 * Deliberately tiny structured logger. The point isn't features — it's that
 * every log line in the app goes through one place with a consistent shape
 * (`{ level, scope, msg, ...meta }`), so swapping in a real provider later
 * (e.g. pino, Axiom) touches one file, not forty call sites.
 */
type Level = "debug" | "info" | "warn" | "error";

function log(level: Level, scope: string, msg: string, meta?: Record<string, unknown>) {
  const line = { level, scope, msg, ...meta, ts: new Date().toISOString() };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", scope, msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", scope, msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", scope, msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", scope, msg, meta),
  };
}
