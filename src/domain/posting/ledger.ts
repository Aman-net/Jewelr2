import type { BalanceDelta, LedgerEntryDelta } from "../types.ts";

export const ZERO_BALANCE: BalanceDelta = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };

/** Balances are always sums of ledger entries — never stored or edited manually. */
export function sumEntries(entries: Pick<LedgerEntryDelta, "cashDeltaPaise" | "goldFineDeltaMg" | "silverFineDeltaMg">[]): BalanceDelta {
  const total: BalanceDelta = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  for (const e of entries) {
    total.cashPaise += e.cashDeltaPaise;
    total.goldFineMg += e.goldFineDeltaMg;
    total.silverFineMg += e.silverFineDeltaMg;
  }
  return total;
}

/**
 * Balance as of date D = sum of entries with businessDate <= D (ISO YYYY-MM-DD compares lexically).
 * Backdated entries change past as-of balances. "Balance as known at a past time" is out of scope.
 */
export function balancesAsOf(
  entries: (Pick<LedgerEntryDelta, "cashDeltaPaise" | "goldFineDeltaMg" | "silverFineDeltaMg"> & {
    businessDate: string;
  })[],
  date: string,
): BalanceDelta {
  return sumEntries(entries.filter((e) => e.businessDate <= date));
}
