import type { Config } from "tailwindcss";

/**
 * Tailwind scans the top-level dirs (app/, components/, mcp/) so every
 * page, component, and any future module picks up utility classes
 * without further config.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./mcp/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
