import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest needs the `@/*` path alias wired in independently of tsc — tsc
 * reads `tsconfig.json#paths`, but Vitest reads Vite's resolve.alias.
 * Mirroring it here keeps imports identical between tests and runtime.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
