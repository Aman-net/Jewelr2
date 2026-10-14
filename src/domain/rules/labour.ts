import { labourOnPhysical } from "../numeric/labour.ts";

/**
 * PROVISIONAL rule Q5 — labour basis.
 * Owner decision (2026-10-14): labour on PHYSICAL weight, paise per gram, cash only.
 * Sales carry labour; purchases carry none unless explicitly entered.
 * TODO(owner): Q5 — confirm labour never applies to purchases; share a bill showing labour math.
 */
export function computeLabour(
  physicalMg: number,
  labourPaisePerGram: number | undefined,
  voucherType: "SALE" | "PURCHASE",
): number {
  if (labourPaisePerGram === undefined || labourPaisePerGram === 0) return 0;
  if (voucherType === "PURCHASE") return 0;
  return labourOnPhysical(physicalMg, labourPaisePerGram);
}
