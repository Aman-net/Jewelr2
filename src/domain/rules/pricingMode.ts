import type { MetalType, PricingMode, RateUnit } from "../types.ts";

/**
 * PROVISIONAL rule Q1 — pricing mode on sale/purchase.
 * Owner decision (2026-10-14): support BOTH modes, mixable per line.
 * A CASH_AT_RATE line owes cash now; a METAL_OPEN line owes fine metal (rate fixed later).
 * TODO(owner): Q1 — confirm with a real register example that one bill can mix both modes.
 */
export function isCashPriced(mode: PricingMode): boolean {
  return mode === "CASH_AT_RATE";
}

export function expectedRateUnit(metal: MetalType): RateUnit {
  return metal === "GOLD" ? "GOLD_PER_10G" : "SILVER_PER_KG";
}
