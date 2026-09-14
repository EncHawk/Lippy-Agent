import { describe, it, expect } from "vitest";
import { contractDefinitionSchema, contractFieldSchema } from "../lib/contracts/schema";
import { diffFields } from "../lib/semantic/diff";
import { validateAgainstContract } from "../lib/contracts/validator";
import { createFixture, extractFixture, mutateFixture, repairFixture } from "../lib/fixtures/scraper";
const fields = contractFieldSchema.array().parse([{ key: "product", type: "string", expectedValue: "Example product" }, { key: "price", type: "number", minimum: 0, maxRelativeChange: 0.5 }]);
describe("semantic contract verification", () => {
  it("treats the first accepted run as baseline", () => expect(diffFields(fields, null, { price: 100 })).toEqual([]));
  it("ignores equivalent whitespace and unicode formatting", () => expect(diffFields(fields, { product: "Example product" }, { product: " Example   product " })).toEqual([]));
  it("reports a real price change and flags a policy breach", () => {
    expect(diffFields(fields, { price: 100 }, { price: 110 })[0]?.reviewRequired).toBe(false);
    expect(diffFields(fields, { price: 100 }, { price: 500 })[0]?.reviewRequired).toBe(true);
  });
  it("handles a zero baseline and optional-field removal", () => {
    expect(diffFields(fields, { price: 0 }, { price: 1 })[0]?.reviewRequired).toBe(true);
    expect(diffFields(fields, { price: 100 }, {})[0]?.currentValue).toBe(null);
  });
  it("rejects schema-valid data from the wrong product", () => expect(validateAgainstContract(fields, { product: "Another product", price: 100 }).ok).toBe(false));
  it("rejects duplicate and prototype field names", () => {
    for (const keys of [["a", "a"], ["__proto__"]]) expect(contractDefinitionSchema.safeParse({ url: "https://example.com", fields: keys.map(key => ({ key, type: "string" })) }).success).toBe(false);
  });
  it("repairs changed HTML selectors, then actually re-extracts", () => {
    const initial = createFixture(fields), broken = mutateFixture(initial, "layout");
    expect(validateAgainstContract(fields, extractFixture(broken, fields)).ok).toBe(false);
    const repaired = repairFixture(broken, fields);
    expect(repaired.diff).toHaveLength(2);
    expect(validateAgainstContract(fields, extractFixture(repaired.fixture, fields)).ok).toBe(true);
    expect(extractFixture(initial, fields).product).toBe("Example product");
  });
  it("does not fabricate values when the source removes them", () => {
    const gone = mutateFixture(createFixture(fields), "unrepairable");
    expect(validateAgainstContract(fields, extractFixture(repairFixture(gone, fields).fixture, fields)).ok).toBe(false);
  });
});
