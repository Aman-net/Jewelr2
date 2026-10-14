import { CALCULATION_VERSION } from "../version.ts";
import { reversalBusinessDate } from "../rules/reversal.ts";
import { negateDeltas } from "./postVoucher.ts";
import type { BalanceDelta, Voucher } from "../types.ts";

export interface ReversalSpec {
  reversalId: string;
  shopId: string;
  originalVoucherId: string;
  originalPartyId: string;
  /** Reversal entries use the ORIGINAL business date (PROVISIONAL Q8). */
  originalBusinessDate: string;
  originalDeltas: BalanceDelta;
  reason: string;
  createdAt: string;
}

/**
 * Build a REVERSAL voucher plus its ledger deltas (exactly negated).
 * Pure function — the data layer persists the result atomically.
 */
export function buildReversal(spec: ReversalSpec): { voucher: Voucher; deltas: BalanceDelta } {
  if (!spec.reason.trim()) throw new Error("REVERSAL requires a reason");
  const voucher: Voucher = {
    id: spec.reversalId,
    shopId: spec.shopId,
    type: "REVERSAL",
    partyId: spec.originalPartyId,
    businessDate: reversalBusinessDate(spec.originalBusinessDate),
    reversesVoucherId: spec.originalVoucherId,
    reversalReason: spec.reason,
    calculationVersion: CALCULATION_VERSION,
    lines: [],
    settlement: null,
    conversion: null,
    opening: null,
    adjustment: null,
    createdAt: spec.createdAt,
  };
  return { voucher, deltas: negateDeltas(spec.originalDeltas) };
}
