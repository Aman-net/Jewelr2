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

/** Stored deal rate: "₹1,00,000 per 10 g" / "₹1,00,000 per kg". */
export function formatRate(ratePaise: number, unit: "GOLD_PER_10G" | "SILVER_PER_KG"): string {
  return `${formatINR(ratePaise)} per ${unit === "GOLD_PER_10G" ? "10 g" : "kg"}`;
}

/** Parse user-typed grams ("12.345") → integer mg. Throws on invalid. Commas tolerated (live-grouped input). */
export function parseGramsToMg(raw: string): number {
  const v = new Decimal(raw.trim().replace(/,/g, ""));
  if (!v.isFinite() || v.isNegative()) throw new Error(`Invalid weight: ${raw}`);
  return v.mul(1000).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

/** Parse rupees ("1500.50") → integer paise. Commas tolerated (live-grouped input). */
export function parseRupeesToPaise(raw: string, allowNegative = false): number {
  const v = new Decimal(raw.trim().replace(/,/g, ""));
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

/** Recording time for an ISO timestamp: "1:35 pm". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/** Absolute date, never relative: 12 Jan 2026. Use on bills/prints viewed later. */
export function formatDate(yyyyMmDd: string): string {
  const [yy, mm, dd] = yyyyMmDd.split("-").map(Number);
  return new Date(yy ?? 0, (mm ?? 1) - 1, dd ?? 1).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Khata-style day header: Today / Yesterday / 12 Jan 2026. */
export function dayLabel(yyyyMmDd: string): string {
  const today = todayLocal();
  if (yyyyMmDd === today) return "Today";
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  if (yyyyMmDd === yesterday) return "Yesterday";
  const [yy, mm, dd] = yyyyMmDd.split("-").map(Number);
  return new Date(yy ?? 0, (mm ?? 1) - 1, dd ?? 1).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
