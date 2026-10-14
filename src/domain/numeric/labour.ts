import Decimal from "decimal.js";
import { roundPaise } from "./rounding.ts";

/**
 * Labour is cash-only and accounted separately.
 * Owner-confirmed basis (2026-10-15, supersedes Q5 provisional): charged on
 * SALE and PURCHASE lines, either PER_PIECE (needs item count) or PER_KG.
 * Per-kg rates normalize to per-gram internally (÷ 1000).
 */
export function labourOnPhysical(physicalMg: number, labourPaisePerGram: number): number {
  // physicalGrams = physicalMg / 1000; labour = grams * rate, rounded once.
  return roundPaise(new Decimal(physicalMg).mul(labourPaisePerGram).div(1000));
}

/** Per-kg rate: exact paise for a physical weight. */
export function labourPerKg(physicalMg: number, labourPaisePerKg: number): number {
  return roundPaise(new Decimal(physicalMg).mul(labourPaisePerKg).div(1_000_000));
}

/** Per-piece rate: count × rate, exact paise. */
export function labourPerPiece(itemCount: number, labourPaisePerPiece: number): number {
  return roundPaise(new Decimal(itemCount).mul(labourPaisePerPiece));
}
