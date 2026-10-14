import Decimal from "decimal.js";
import { en } from "../i18n/en.ts";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

/** Integer paise → ₹ string in Indian grouping (₹1,00,000.00). */
export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

/** Signed paise with direction word, e.g. { text: "₹500.00", direction: "in" }. */
export function balanceText(paise: number): { text: string; direction: "in" | "out" | "flat" } {
  if (paise > 0) return { text: formatINR(paise), direction: "in" };
  if (paise < 0) return { text: formatINR(-paise), direction: "out" };
  return { text: formatINR(0), direction: "flat" };
}

/** Integer milligrams → grams string, trimmed (80000 mg → "80 g"). */
export function formatGram(mg: number): string {
  const g = new Decimal(mg).div(1000).toFixed(3).replace(/\.?0+$/, "");
  return `${g} ${en.units.g}`;
}

/** Scaled tunch (8000) → "80%". */
export function formatTunch(scaled: number): string {
  return `${new Decimal(scaled).div(100).toString()}${en.units.percent}`;
}

/** Parse user-typed grams ("12.345") → integer mg. Throws on invalid. */
export function parseGramsToMg(raw: string): number {
  const v = new Decimal(raw.trim());
  if (!v.isFinite() || v.isNegative()) throw new Error(`Invalid weight: ${raw}`);
  return v.mul(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Parse rupees ("1500.50") → integer paise. */
export function parseRupeesToPaise(raw: string, allowNegative = false): number {
  const v = new Decimal(raw.trim());
  if (!v.isFinite() || (!allowNegative && v.isNegative())) throw new Error(`Invalid amount: ${raw}`);
  return v.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Parse percent ("80" or "80.5") → scaled tunch (8000). */
export function parsePercentToScaled(raw: string): number {
  const v = new Decimal(raw.trim());
  if (!v.isFinite() || v.isNegative() || v.greaterThan(100)) throw new Error(`Invalid tunch: ${raw}`);
  return v.mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Today as YYYY-MM-DD in local time. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Days between now and an ISO timestamp. */
export function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}
