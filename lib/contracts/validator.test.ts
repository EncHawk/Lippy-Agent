import { describe, it, expect } from "vitest";
import { validateAgainstContract } from "@/lib/contracts/validator";
import type { ContractField } from "@/lib/contracts/schema";

const fields: ContractField[] = [
  { key: "product", type: "string", required: true },
  { key: "price", type: "number", required: true },
  { key: "stock", type: "boolean", required: false },
];

describe("validateAgainstContract", () => {
  it("passes when extraction matches the contract", () => {
    const result = validateAgainstContract(fields, {
      product: "MacBook Air",
      price: 99990,
      stock: true,
    });
    expect(result.ok).toBe(true);
  });

  it("flags a violation when a required field is null (the structural-drift case)", () => {
    const result = validateAgainstContract(fields, {
      product: "MacBook Air",
      price: null,
      stock: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]?.key).toBe("price");
      expect(result.violations[0]?.expectedType).toBe("number");
    }
  });

  it("allows an optional field to be missing", () => {
    const result = validateAgainstContract(fields, {
      product: "MacBook Air",
      price: 99990,
    });
    expect(result.ok).toBe(true);
  });

  it("flags a type mismatch even when the field is present", () => {
    const result = validateAgainstContract(fields, {
      product: "MacBook Air",
      price: "₹99,990", // wrong type: string instead of number
      stock: true,
    });
    expect(result.ok).toBe(false);
  });
});
