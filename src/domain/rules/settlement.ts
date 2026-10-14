import type { BalanceDelta, SettlementInput } from "../types.ts";
import { settlementFineMg } from "./tunch.ts";

/**
 * PROVISIONAL rule Q3 — mixed settlement.
 * Owner decision (2026-10-14): each component reduces its OWN column.
 * "Metal first, cash after" is UX display order only — never a silent cross-column conversion.
 * TODO(owner): Q3 — confirm with one real mixed metal+cash receipt.
 */
export function settlementToDeltas(s: SettlementInput): BalanceDelta {
  const goldFineMg =
    s.goldPhysicalMg && s.goldTunchScaled !== undefined
      ? settlementFineMg(s.goldPhysicalMg, s.goldTunchScaled)
      : 0;
  const silverFineMg =
    s.silverPhysicalMg && s.silverTunchScaled !== undefined
      ? settlementFineMg(s.silverPhysicalMg, s.silverTunchScaled)
      : 0;
  return {
    cashPaise: s.cashPaise ?? 0,
    goldFineMg,
    silverFineMg,
  };
}
