import type { ReactNode } from "react";
import { BackButton } from "./BackButton.tsx";
import { formatGram, formatINR } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("press rounded-2xl border border-stone-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

export function Page({ title, subtitle, action, backTo, backLabel, contentClass, children }: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backTo?: string;
  backLabel?: string;
  /** Opt-in stagger for list-shaped pages: children cascade in on mount. */
  contentClass?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center gap-2">
        {backTo ? <BackButton fallback={backTo} label={backLabel} /> : null}
        <div className="min-w-0 flex-1">
          {title ? <h1 className="truncate text-xl font-bold tracking-tight text-stone-900">{title}</h1> : null}
          {subtitle ? <div className="text-xs text-stone-500">{subtitle}</div> : null}
        </div>
        {action}
      </div>
      <div className={cn("flex flex-col gap-3", contentClass)}>{children}</div>
    </div>
  );
}

const TONES = {
  light: { get: "text-emerald-700", give: "text-red-700", goldGet: "text-amber-700", silverGet: "text-slate-600" },
  dark: { get: "text-emerald-300", give: "text-red-300", goldGet: "text-amber-300", silverGet: "text-slate-200" },
} as const;

/** Three-column money/metal readout with equal weight. Positive = party owes shop.
 * Signed always: + means you get, − means you give. Color is never the only signal. */
export function BalanceGrid({ cashPaise, goldFineMg, silverFineMg, dark }: {
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
  dark?: boolean;
}) {
  const t = dark ? TONES.dark : TONES.light;
  const muted = "text-stone-400";
  const faint = dark ? "text-stone-300" : "text-stone-500";
  const signedCash = cashPaise === 0 ? formatINR(0) : `${cashPaise > 0 ? "+" : "−"}${formatINR(Math.abs(cashPaise))}`;
  const signedGold = goldFineMg === 0 ? formatGram(0) : `${goldFineMg > 0 ? "+" : "−"}${formatGram(Math.abs(goldFineMg))}`;
  const signedSilver = silverFineMg === 0 ? formatGram(0) : `${silverFineMg > 0 ? "+" : "−"}${formatGram(Math.abs(silverFineMg))}`;
  const cells: { label: string; dot?: string; value: string; sub: string; tone: string }[] = [
    {
      label: "Cash",
      value: signedCash,
      sub: cashPaise === 0 ? "settled" : cashPaise > 0 ? "you get" : "you give",
      tone: cashPaise === 0 ? "" : cashPaise > 0 ? t.get : t.give,
    },
    {
      label: "Gold fine",
      dot: "bg-amber-500",
      value: signedGold,
      sub: goldFineMg === 0 ? "settled" : goldFineMg > 0 ? "you get" : "you give",
      tone: goldFineMg === 0 ? "" : goldFineMg > 0 ? t.goldGet : t.give,
    },
    {
      label: "Silver fine",
      dot: "bg-slate-400",
      value: signedSilver,
      sub: silverFineMg === 0 ? "settled" : silverFineMg > 0 ? "you get" : "you give",
      tone: silverFineMg === 0 ? "" : silverFineMg > 0 ? t.silverGet : t.give,
    },
  ];
  return (
    <div className="mini-stagger grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.label} className={cn("rounded-xl px-2 py-2 text-center", dark ? "bg-white/10" : "bg-stone-50")}>
          <div className={cn("flex items-center justify-center gap-1 text-[11px] font-medium uppercase tracking-wide", faint)}>
            {c.dot ? <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} /> : null}
            {c.label}
          </div>
          <div className={cn("truncate text-sm font-bold", c.tone || muted)}>{c.value}</div>
          <div className={cn("text-[11px]", faint)}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
