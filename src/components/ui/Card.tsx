import type { ReactNode } from "react";
import { formatGram, formatINR } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-2xl border border-stone-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
}

export function Page({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-stone-900">{title}</h1>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

/** Three-column money/metal balance readout. Positive = party owes shop. */
export function BalanceGrid({ cashPaise, goldFineMg, silverFineMg }: {
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
}) {
  const cells: { label: string; value: string; tone: string }[] = [
    {
      label: "Cash",
      value: formatINR(cashPaise),
      tone: cashPaise === 0 ? "text-stone-400" : cashPaise > 0 ? "text-emerald-700" : "text-red-700",
    },
    {
      label: "Gold fine",
      value: formatGram(goldFineMg),
      tone: goldFineMg === 0 ? "text-stone-400" : goldFineMg > 0 ? "text-emerald-700" : "text-red-700",
    },
    {
      label: "Silver fine",
      value: formatGram(silverFineMg),
      tone: silverFineMg === 0 ? "text-stone-400" : silverFineMg > 0 ? "text-emerald-700" : "text-red-700",
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl bg-stone-50 px-2 py-2 text-center">
          <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{c.label}</div>
          <div className={cn("truncate text-sm font-semibold", c.tone)}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}
