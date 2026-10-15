import { describe, expect, it } from "vitest";
import { g3, rs2, signed2, signedG3, statementNo } from "./StatementPdf.tsx";

describe("statement pdf helpers", () => {
  it("numbers are pdf-safe (no ₹, exact grams)", () => {
    expect(rs2(12500)).toBe("Rs 125.00");
    expect(g3(20000)).toBe("20.000 g");
    expect(signed2(-20000)).toBe("-200.00");
    expect(signed2(0)).toBe("—");
    expect(signedG3(50000)).toBe("+50.000");
  });

  it("statement numbers are deterministic per party+period", () => {
    const a = statementNo("party-1", "2026-10-01", "2026-10-15");
    expect(statementNo("party-1", "2026-10-01", "2026-10-15")).toBe(a);
    expect(a).toMatch(/^KS-20261015-\d{3}$/);
    expect(statementNo("party-2", "2026-10-01", "2026-10-15")).not.toBe(a);
  });
});
