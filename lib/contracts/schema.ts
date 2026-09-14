import { z } from "zod";
export const contractFieldTypeSchema = z.enum(["string", "number", "boolean", "url"]);
export type ContractFieldType = z.infer<typeof contractFieldTypeSchema>;
export const contractFieldSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
    .refine(v => !["__proto__", "constructor", "prototype"].includes(v), "Reserved field name"),
  type: contractFieldTypeSchema,
  required: z.boolean().default(true),
  description: z.string().max(1000).optional(),
  selectorHint: z.string().max(500).optional(),
  minimum: z.number().finite().optional(),
  maximum: z.number().finite().optional(),
  expectedValue: z.union([z.string(), z.number().finite(), z.boolean()]).optional(),
  maxRelativeChange: z.number().nonnegative().optional(),
  ignoreCase: z.boolean().default(false),
}).superRefine((f, ctx) => {
  if (f.minimum !== undefined && f.maximum !== undefined && f.minimum > f.maximum)
    ctx.addIssue({ code: "custom", message: "minimum exceeds maximum" });
  if (f.type !== "number" && [f.minimum, f.maximum, f.maxRelativeChange].some(v => v !== undefined))
    ctx.addIssue({ code: "custom", message: "Numeric constraints require a number field" });
  if (f.expectedValue !== undefined && typeof f.expectedValue !== (f.type === "url" ? "string" : f.type))
    ctx.addIssue({ code: "custom", message: "expectedValue must match the field type" });
});
export type ContractField = z.infer<typeof contractFieldSchema>;
export const contractDefinitionSchema = z.object({
  url: z.string().url().max(2048).refine(v => {
    const u = new URL(v); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password;
  }, "Use an HTTP(S) URL without credentials"),
  fields: z.array(contractFieldSchema).min(1).max(50).refine(f => new Set(f.map(x => x.key)).size === f.length, "Duplicate field keys"),
  pollIntervalMs: z.number().int().min(10000).max(2147483647).default(300000),
  collectorId: z.string().regex(/^c_[a-zA-Z0-9_]+$/).optional(),
  enabled: z.boolean().default(true),
});
export type ContractDefinition = z.infer<typeof contractDefinitionSchema>;
export function buildRuntimeValidator(fields: ContractField[]) {
  const shape: z.ZodRawShape = Object.create(null);
  for (const field of fields) {
    let base: z.ZodTypeAny;
    if (field.type === "number") {
      let n = z.number().finite();
      if (field.minimum !== undefined) n = n.min(field.minimum);
      if (field.maximum !== undefined) n = n.max(field.maximum);
      base = n;
    } else if (field.type === "boolean") base = z.boolean();
    else if (field.type === "url") base = z.string().url();
    else base = z.string().trim().min(1);
    if (field.expectedValue !== undefined) base = base.refine(v => v === field.expectedValue, "Value does not match the expected identity/value");
    shape[field.key] = field.required ? base : base.nullable().optional();
  }
  return z.object(shape);
}
