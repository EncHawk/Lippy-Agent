import { load } from "cheerio";
import type { ContractField } from "../contracts/schema";
export type Fixture = { html: string; selectors: Record<string, string> };
const escape = (value: unknown) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
export function createFixture(fields: ContractField[]): Fixture {
  const selectors: Record<string, string> = {};
  const html = fields.map(field => {
    selectors[field.key] = `#old_${field.key}`;
    const value = field.expectedValue ?? (field.type === "number" ? Math.min(field.maximum ?? Number.MAX_VALUE, Math.max(field.minimum ?? -Number.MAX_VALUE, 100)) : field.type === "boolean" ? true : field.type === "url" ? "https://example.com/item" : field.key === "product" ? "Example product" : `Example ${field.key}`);
    return `<span id="old_${field.key}" data-field="${field.key}">${escape(value)}</span>`;
  }).join("");
  return { html, selectors };
}
export function extractFixture(fixture: Fixture, fields: ContractField[]): Record<string, unknown> {
  const $ = load(fixture.html);
  return Object.fromEntries(fields.map(field => {
    const matches = $(fixture.selectors[field.key] ?? `#missing_${field.key}`);
    if (matches.length !== 1) return [field.key, null];
    const text = matches.text().trim();
    const value = field.type === "number" ? (text !== "" && Number.isFinite(Number(text)) ? Number(text) : text)
      : field.type === "boolean" ? (text === "true" ? true : text === "false" ? false : text) : text;
    return [field.key, value];
  }));
}
export function repairFixture(fixture: Fixture, fields: ContractField[]) {
  const $ = load(fixture.html);
  const selectors = { ...fixture.selectors };
  const diff = fields.flatMap(field => {
    const next = `[data-field="${field.key}"]`;
    if ($(next).length !== 1 || selectors[field.key] === next) return [];
    const oldSelector = selectors[field.key]; selectors[field.key] = next;
    return [{ field: field.key, oldSelector, newSelector: next }];
  });
  return { fixture: { ...fixture, selectors }, diff };
}
export function mutateFixture(fixture: Fixture, scenario: "layout" | "value" | "unrepairable", field?: string, value?: string): Fixture {
  const $ = load(fixture.html);
  if (scenario === "layout") $("[data-field]").each((_, el) => { $(el).attr("id", `new_${$(el).attr("data-field")}`); });
  if (scenario === "unrepairable") $("[data-field]").remove();
  if (scenario === "value" && field) $(`[data-field="${field}"]`).text(value ?? "");
  return { html: $.html(), selectors: fixture.selectors };
}
