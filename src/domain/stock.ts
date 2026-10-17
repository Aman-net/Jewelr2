import type { Voucher } from "./types.ts";

/**
 * Shop stock moves on trade. Sign follows the shelf, not the khata:
 * PURCHASE adds, SALE subtracts. Money direction is the mirror image.
 * pcs counts only when the line carries a count (pieces are optional).
 */
export interface TradeMove {
  metalType: "GOLD" | "SILVER";
  itemName: string;
  physicalMg: number;
  pcs: number;
  hasPcs: boolean;
  fineMg: number;
}

export function tradeMoves(v: Voucher): TradeMove[] {
  if (v.type !== "SALE" && v.type !== "PURCHASE") return [];
  const sign = v.type === "PURCHASE" ? 1 : -1;
  return v.lines.map((l) => ({
    metalType: l.metalType,
    itemName: l.categoryName,
    physicalMg: sign * l.physicalMg,
    pcs: sign * (l.itemCount ?? 0),
    hasPcs: l.itemCount !== undefined,
    fineMg: sign * l.fineMg,
  }));
}
