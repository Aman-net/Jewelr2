/**
 * PROVISIONAL rule Q8 — reversal dating.
 * Owner decision (2026-10-14): reversal entries use the ORIGINAL voucher's businessDate,
 * so past as-of balances reflect corrected history. createdAt records when corrected.
 * TODO(owner): Q8 — confirm corrections should rewrite past as-of balances (vs forward-only).
 */
export function reversalBusinessDate(originalBusinessDate: string): string {
  return originalBusinessDate;
}
