import { z } from "zod";

/**
 * A ContractField is user-authored (via the dashboard or MCP `create_contract`
 * tool) and describes what "valid data from this source" means. It is the
 * single source of truth: the same field list is used to (a) build the
 * self-heal prompt Bright Data receives, (b) build the runtime Zod
 * validator, and (c) render the contract in the dashboard — so there is no
 * risk of the UI, the validator, and the heal prompt drifting apart.
 */
export const contractFieldTypeSchema = z.enum(["string", "number", "boolean", "url"]);
export type ContractFieldType = z.infer<typeof contractFieldTypeSchema>;

export const contractFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Field key must be a valid identifier."),
  type: contractFieldTypeSchema,
  required: z.boolean().default(true),
  /** Last known-good selector hint, fed to the heal prompt when this field breaks. */
  selectorHint: z.string().optional(),
});
export type ContractField = z.infer<typeof contractFieldSchema>;

export const contractDefinitionSchema = z.object({
  url: z.string().url(),
  fields: z.array(contractFieldSchema).min(1, "A contract needs at least one field."),
  pollIntervalMs: z.number().int().positive().default(5 * 60 * 1000),
});
export type ContractDefinition = z.infer<typeof contractDefinitionSchema>;

const ZOD_BY_FIELD_TYPE: Record<ContractFieldType, z.ZodTypeAny> = {
  string: z.string().min(1),
  number: z.number().finite(),
  boolean: z.boolean(),
  url: z.string().url(),
};

/**
 * Builds a Zod object schema from a contract's field list at runtime. This
 * is what "the contract" actually compiles down to when we validate an
 * extraction result — every run is checked against exactly this.
 */
export function buildRuntimeValidator(fields: ContractField[]): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const field of fields) {
    const base = ZOD_BY_FIELD_TYPE[field.type];
    shape[field.key] = field.required ? base : base.nullable().optional();
  }
  return z.object(shape);
}
