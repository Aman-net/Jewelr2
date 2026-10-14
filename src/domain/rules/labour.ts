import { labourPerKg, labourPerPiece } from "../numeric/labour.ts";
import type { LabourMode } from "../types.ts";

/**
 * Owner-confirmed labour rule (2026-10-15, was PROVISIONAL Q5): cash-only,
 * on SALE and PURCHASE lines, PER_PIECE (item count required) or PER_KG.
 */
export function computeLabour(
  physicalMg: number,
  itemCount: number | undefined,
  mode: LabourMode | undefined,
  ratePaise: number | undefined,
): number {
  if (mode === undefined || ratePaise === undefined || ratePaise === 0) return 0;
  if (mode === "PER_PIECE") {
    if (itemCount === undefined || itemCount <= 0) {
      throw new Error("Per-piece labour needs a positive item count");
    }
    return labourPerPiece(itemCount, ratePaise);
  }
  return labourPerKg(physicalMg, ratePaise);
}
