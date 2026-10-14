import Decimal from "decimal.js";
import { roundMg, roundPaise } from "./rounding.ts";

/** Milligrams in the quote unit: 10 g gold = 10,000 mg; 1 kg silver = 1,000,000 mg. */
export const GOLD_QUOTE_MG = 10_000;
export const SILVER_QUOTE_MG = 1_000_000;

/** Value of fine metal at a stored rate. Rate unit must be explicit, never inferred. */
export function fineToCash(fineMg: number, ratePaise: number, quoteMg: number): number {
  return roundPaise(new Decimal(fineMg).mul(ratePaise).div(quoteMg));
}

export function goldFineToCash(fineMg: number, ratePaisePer10g: number): number {
  return fineToCash(fineMg, ratePaisePer10g, GOLD_QUOTE_MG);
}

export function silverFineToCash(fineMg: number, ratePaisePerKg: number): number {
  return fineToCash(fineMg, ratePaisePerKg, SILVER_QUOTE_MG);
}

/** Cash to fine metal at a stored rate (used by CONVERSION CASH_TO_METAL). */
export function cashToFine(cashPaise: number, ratePaise: number, quoteMg: number): number {
  return roundMg(new Decimal(cashPaise).mul(quoteMg).div(ratePaise));
}

export function cashToGoldFine(cashPaise: number, ratePaisePer10g: number): number {
  return cashToFine(cashPaise, ratePaisePer10g, GOLD_QUOTE_MG);
}

export function cashToSilverFine(cashPaise: number, ratePaisePerKg: number): number {
  return cashToFine(cashPaise, ratePaisePerKg, SILVER_QUOTE_MG);
}
