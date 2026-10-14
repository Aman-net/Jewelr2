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

/** Compact one-line dues for rows: coloured amount + metal hints. */
export function DuesLine({ cashPaise, goldFineMg, silverFineMg }: {
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
}) {
  const parts: string[] = [];
  if (goldFineMg !== 0) parts.push(`G ${formatGram(Math.abs(goldFineMg))}`);
  if (silverFineMg !== 0) parts.push(`S ${formatGram(Math.abs(silverFineMg))}`);
  return (
    <div className="text-right">
      <div className={cn(
        "text-sm font-semibold",
        cashPaise === 0 ? "text-stone-400" : cashPaise > 0 ? "text-emerald-700" : "text-red-700",
      )}>
        {formatINR(cashPaise)}
      </div>
      {parts.length > 0 && <div className="text-[11px] text-stone-500">{parts.join(" · ")}</div>}
    </div>
  );
}
