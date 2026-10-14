import { describe, expect, it } from "vitest";
import {
  balanceText,
  formatGram,
  formatINR,
  formatTunch,
  parseGramsToMg,
  parsePercentToScaled,
  parseRupeesToPaise,
} from "./format.ts";

describe("display formatting", () => {
  it("formats rupees in Indian grouping", () => {
    expect(formatINR(10000000)).toBe("₹1,00,000.00");
    expect(formatINR(-500)).toBe("-₹5.00");
  });

  it("formats fine weights trimmed", () => {
    expect(formatGram(80_000)).toBe("80 g");
    expect(formatGram(10_500)).toBe("10.5 g");
    expect(formatGram(1)).toBe("0.001 g");
  });

  it("formats tunch", () => {
    expect(formatTunch(8000)).toBe("80%");
    expect(balanceText(0).direction).toBe("flat");
    expect(balanceText(5).direction).toBe("in");
    expect(balanceText(-5).direction).toBe("out");
  });
});

describe("input parsing", () => {
  it("parses grams, rupees and percent exactly", () => {
    expect(parseGramsToMg("12.345")).toBe(12_345);
    expect(parseRupeesToPaise("1500.50")).toBe(150_050);
    expect(parsePercentToScaled("80")).toBe(8000);
    expect(parsePercentToScaled("91.6")).toBe(9160);
  });

  it("rejects invalid input", () => {
    expect(() => parseGramsToMg("abc")).toThrow();
    expect(() => parseGramsToMg("-2")).toThrow();
    expect(() => parseRupeesToPaise("")).toThrow();
    expect(() => parsePercentToScaled("101")).toThrow();
  });
});
