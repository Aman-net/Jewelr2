import type { BalanceDelta } from "../types.ts";

/**
 * PROVISIONAL rule Q4 — opening balance unit.
 * Owner decision (2026-10-14): opening metal balances are in FINE weight.
 * TODO(owner): Q4 — confirm the paper khata's existing metal balances are fine, not physical.
 */
export function interpretOpeningMetal(opening: BalanceDelta): BalanceDelta {
  return opening;
}
