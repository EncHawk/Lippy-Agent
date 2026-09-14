import parser from "@typescript-eslint/parser";
import nextPlugin from "@next/eslint-plugin-next";
import plugin from "@typescript-eslint/eslint-plugin";
export default [
  { ignores: ["node_modules/**", ".next/**", "next-env.d.ts", "coverage/**"] },
  { files: ["**/*.ts", "**/*.tsx"], languageOptions: { parser, parserOptions: { ecmaVersion: "latest", sourceType: "module" } }, plugins: { "@typescript-eslint": plugin, "@next/next": nextPlugin },
    rules: { "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }], "@typescript-eslint/no-floating-promises": "off" } },
];
