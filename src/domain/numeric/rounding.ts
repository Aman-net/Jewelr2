import Decimal from "decimal.js";

/**
 * Round half up to the nearest integer.
 * PROVISIONAL default (Q6): line-level rounding, half up, to paise/milligram.
 * TODO(owner): Q6 — confirm line-level vs voucher-level, paise vs rupee.
 */
export function roundHalfUp(value: number | string | Decimal): number {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Round a paise amount to whole paise (half up). */
export function roundPaise(value: number | string | Decimal): number {
  return roundHalfUp(value);
}

/** Round a weight to whole milligrams (half up). Gold precision (owner-confirmed 2026-10-16). */
export function roundMg(value: number | string | Decimal): number {
  return roundHalfUp(value);
}

/**
 * Round silver to whole grams, half up (owner-confirmed 2026-10-16:
 * 2.3 g → 2 g, 4.5 g → 5 g). Any sub-gram silver value anywhere in the
 * app is a roundoff of the gram figure.
 */
export function roundSilverMg(mg: number | string | Decimal): number {
  return new Decimal(mg).div(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(1000).toNumber();
}

/** Canonical stored weight: gold keeps milligrams, silver whole grams. */
export function roundMetalMg(mg: number, metal: "GOLD" | "SILVER"): number {
  return metal === "SILVER" ? roundSilverMg(mg) : roundMg(mg);
}
