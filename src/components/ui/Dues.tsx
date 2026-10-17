import { cn } from "../../lib/cn.ts";
import { formatGram, formatINR } from "../../lib/format.ts";

/**
 * Operator-framed balance: "You will get" (receivable, emerald) vs
 * "You will give" (payable, red). Positive = party owes shop.
 */
export function DuesHead({ cashPaise, goldFineMg, silverFineMg, size = "lg" }: {
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
  size?: "lg" | "sm";
}) {
  const inward = cashPaise >= 0;
  return (
    <div>
      <div className={cn("text-xs font-medium uppercase tracking-wide", inward ? "text-emerald-700" : "text-red-700")}>
        {cashPaise === 0 ? "Settled in cash" : inward ? "You will get" : "You will give"}
      </div>
      <div className={cn("font-bold text-stone-900", size === "lg" ? "text-3xl" : "text-lg")}>
        {formatINR(Math.abs(cashPaise))}
      </div>
      {(goldFineMg !== 0 || silverFineMg !== 0) && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {goldFineMg !== 0 && (
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              goldFineMg > 0 ? "bg-amber-100 text-amber-900" : "bg-stone-200 text-stone-700",
            )}>
              {goldFineMg > 0 ? "Get " : "Give "}{formatGram(Math.abs(goldFineMg))} gold
            </span>
          )}
          {silverFineMg !== 0 && (
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-semibold",
              silverFineMg > 0 ? "bg-slate-200 text-slate-800" : "bg-stone-200 text-stone-700",
            )}>
              {silverFineMg > 0 ? "Get " : "Give "}{formatGram(Math.abs(silverFineMg))} silver
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact dues for rows, symbol convention like the rest of the app:
 * "+₹500 · +G 80 g · −S 20 g" (+ = you get, − = you give). Metal dues lead. */
export function DuesLine({ cashPaise, goldFineMg, silverFineMg }: {
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
}) {
  const signed = (v: number, text: string) => (v === 0 ? text : `${v > 0 ? "+" : "−"}${text}`);
  const metalFirst = goldFineMg !== 0 || silverFineMg !== 0;
  if (!metalFirst) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className={cn(
          "text-sm font-bold tabular-nums",
          cashPaise === 0 ? "text-stone-400" : cashPaise > 0 ? "text-emerald-700" : "text-red-700",
        )}>
          {signed(cashPaise, formatINR(Math.abs(cashPaise)))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <div className="flex items-center gap-2 text-sm font-bold tabular-nums">
        {goldFineMg !== 0 && (
          <span className={goldFineMg > 0 ? "text-emerald-700" : "text-red-700"}>
            {signed(goldFineMg, `G ${formatGram(Math.abs(goldFineMg))}`)}
          </span>
        )}
        {silverFineMg !== 0 && (
          <span className={silverFineMg > 0 ? "text-emerald-700" : "text-red-700"}>
            {signed(silverFineMg, `S ${formatGram(Math.abs(silverFineMg))}`)}
          </span>
        )}
      </div>
      <span className={cn(
        "text-xs font-medium tabular-nums",
        cashPaise === 0 ? "text-stone-400" : cashPaise > 0 ? "text-emerald-700" : "text-red-700",
      )}>
        {signed(cashPaise, formatINR(Math.abs(cashPaise)))}
      </span>
    </div>
  );
}

/** Signed cash delta for entry rows: + (emerald) / − (red). Null when zero. */
export function CashDelta({ paise }: { paise: number }) {
  if (paise === 0) return null;
  return (
    <span className={cn("font-semibold tabular-nums", paise > 0 ? "text-emerald-700" : "text-red-700")}>
      {paise > 0 ? "+" : "−"}{formatINR(Math.abs(paise))}
    </span>
  );
}

/** Signed metal delta with unit letter: +G 80 g / −S 20 g. Null when zero. */
export function MetalDelta({ mg, metal }: { mg: number; metal: "GOLD" | "SILVER" }) {
  if (mg === 0) return null;
  return (
    <span className={cn("font-semibold tabular-nums", metal === "GOLD" ? "text-amber-700" : "text-slate-600")}>
      {mg > 0 ? "+" : "−"}{metal === "GOLD" ? "G" : "S"} {formatGram(Math.abs(mg))}
    </span>
  );
}
