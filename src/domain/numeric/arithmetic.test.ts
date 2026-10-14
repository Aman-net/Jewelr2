import { describe, expect, it } from "vitest";
import { fineFromPhysical } from "./tunch.ts";
import {
  GOLD_QUOTE_MG,
  SILVER_QUOTE_MG,
  cashToGoldFine,
  cashToSilverFine,
  fineToCash,
  goldFineToCash,
  silverFineToCash,
} from "./metalValue.ts";
import { labourOnPhysical, labourPerKg, labourPerPiece } from "./labour.ts";
import { roundHalfUp } from "./rounding.ts";

describe("tunch to fine weight", () => {
  it("100 g at 80% gives 80 g fine", () => {
    expect(fineFromPhysical(100_000, 8000)).toBe(80_000);
  });
  it("100 g at 70% gives 70 g fine; margin is 10 g", () => {
    expect(fineFromPhysical(100_000, 7000)).toBe(70_000);
    expect(fineFromPhysical(100_000, 8000) - fineFromPhysical(100_000, 7000)).toBe(10_000);
  });
  it("rounds half up to the milligram", () => {
    // 1 mg at 33.33% = 0.3333 mg -> 0 mg; 3 mg at 50% = 1.5 mg -> 2 mg
    expect(fineFromPhysical(1, 3333)).toBe(0);
    expect(fineFromPhysical(3, 5000)).toBe(2);
  });
});

describe("fine value at rate", () => {
  it("gold: 10 g fine at Rs 1,00,000/10g = Rs 1,00,000", () => {
    expect(goldFineToCash(10_000, 10_000_000)).toBe(10_000_000);
  });
  it("silver: 1 kg fine at Rs 1,00,000/kg = Rs 1,00,000", () => {
    expect(silverFineToCash(1_000_000, 10_000_000)).toBe(10_000_000);
  });
  it("uses explicit quote units, never inferred", () => {
    expect(GOLD_QUOTE_MG).toBe(10_000);
    expect(SILVER_QUOTE_MG).toBe(1_000_000);
    expect(fineToCash(5_000, 10_000_000, GOLD_QUOTE_MG)).toBe(5_000_000);
  });
});

describe("cash to fine", () => {
  it("gold: Rs 1,00,000 at Rs 1,00,000/10g = 10 g fine", () => {
    expect(cashToGoldFine(10_000_000, 10_000_000)).toBe(10_000);
  });
  it("silver: Rs 1,00,000 at Rs 1,00,000/kg = 1 kg fine", () => {
    expect(cashToSilverFine(10_000_000, 10_000_000)).toBe(1_000_000);
  });
});

describe("labour", () => {
  it("100 g physical at Rs 50/g = Rs 5,000", () => {
    expect(labourOnPhysical(100_000, 5000)).toBe(500_000);
  });
  it("per-kg rate normalizes by 1000 (Rs 50,000/kg on 100 g = Rs 5,000)", () => {
    expect(labourPerKg(100_000, 5_000_000)).toBe(500_000);
  });
  it("per-piece rate multiplies count (4 pcs at Rs 25 = Rs 100)", () => {
    expect(labourPerPiece(4, 2500)).toBe(10_000);
  });
  it("rounds half up to the paise", () => {
    expect(roundHalfUp("2.5")).toBe(3);
    expect(labourOnPhysical(1, 500)).toBe(1); // 0.5 paise -> 1
  });
});
