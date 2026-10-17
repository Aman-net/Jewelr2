import { fineFromPhysical } from "../numeric/tunch.ts";
import { roundMetalMg } from "../numeric/rounding.ts";
import type { MetalType } from "../types.ts";

/**
 * PROVISIONAL rule Q2 — which tunch bills the party.
 * Owner decision (2026-10-14): recordedTunch = physical actual (info only);
 * agreedTunch = billing basis; the party owes fine on AGREED tunch.
 * Metal received/paid credits fine = physical x tested/agreed tunch.
 * TODO(owner): Q2 — verify against a real sale + receipt pair with both tunch values.
 */
export function selectBillingTunch(recordedTunchScaled: number | undefined, agreedTunchScaled: number): number {
  void recordedTunchScaled;
  return agreedTunchScaled;
}

/** Fine owed on a sale/purchase line. Silver rounds to whole grams. */
export function lineFineMg(physicalMg: number, agreedTunchScaled: number, metalType: MetalType): number {
  return roundMetalMg(fineFromPhysical(roundMetalMg(physicalMg, metalType), agreedTunchScaled), metalType);
}

/** Fine credited when metal is received/paid with a tested tunch. Silver rounds to whole grams. */
export function settlementFineMg(physicalMg: number, testedTunchScaled: number, metalType: MetalType): number {
  return roundMetalMg(fineFromPhysical(roundMetalMg(physicalMg, metalType), testedTunchScaled), metalType);
}
