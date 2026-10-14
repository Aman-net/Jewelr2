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

/** Round a weight to whole milligrams (half up). */
export function roundMg(value: number | string | Decimal): number {
  return roundHalfUp(value);
}
