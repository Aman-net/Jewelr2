import Decimal from "decimal.js";
import { roundPaise } from "./rounding.ts";

/**
 * Labour is cash-only and accounted separately.
 * PROVISIONAL basis (Q5): charged on PHYSICAL weight, paise per gram.
 * TODO(owner): Q5 — confirm physical (not fine) basis; confirm purchases carry no labour.
 */
export function labourOnPhysical(physicalMg: number, labourPaisePerGram: number): number {
  // physicalGrams = physicalMg / 1000; labour = grams * rate, rounded once.
  return roundPaise(new Decimal(physicalMg).mul(labourPaisePerGram).div(1000));
}
