import type { ReactNode } from "react";
import { BackButton } from "./BackButton.tsx";
import { cn } from "../../lib/cn.ts";

const TONES: Record<string, string> = {
  amber: "from-amber-600 to-amber-800",
  sky: "from-sky-600 to-sky-800",
  emerald: "from-emerald-600 to-emerald-800",
  orange: "from-orange-600 to-orange-800",
  violet: "from-violet-600 to-violet-800",
  stone: "from-stone-700 to-stone-900",
};

export type FlowTone = keyof typeof TONES;

const VOUCHER_TONES: Record<string, FlowTone> = {
  SALE: "amber",
  PURCHASE: "sky",
  RECEIPT: "emerald",
  PAYMENT: "orange",
  CONVERSION: "violet",
  OPENING: "stone",
  ADJUSTMENT: "stone",
  REVERSAL: "stone",
};

/** Flow colour for a voucher type — detail headers share the entry palette. */
export function toneForVoucher(type: string): FlowTone {
  return VOUCHER_TONES[type] ?? "stone";
}

/**
 * Coloured flow header: big verb, party context, wizard progress.
 * Each entry flow owns a colour so the operator always knows where they are.
 */
export function FlowHeader({ tone, title, context, onChangeContext, current, labels, backTo, backLabel }: {
  tone: FlowTone;
  title: string;
  context?: string;
  onChangeContext?: () => void;
  current: number;
  labels: [string, string, string];
  backTo?: string;
  /** Names where back goes — "Party" while on the details step of a wizard. */
  backLabel?: string;
}) {
  return (
    <div className={cn("rounded-3xl bg-gradient-to-br p-5 text-white shadow-md", TONES[tone])}>
      {backTo ? (
        <div className="mb-1">
          <BackButton
            fallback={backTo}
            label={backLabel}
            className="text-white hover:bg-white/15 active:bg-white/25"
          />
        </div>
      ) : null}
      <div className="text-2xl font-bold tracking-tight">{title}</div>
      {context !== undefined && (
        <div className="mt-1 flex items-center gap-2 text-sm text-white/85">
          <span className="min-w-0 flex-1 truncate">{context || "No party chosen"}</span>
          {onChangeContext && context ? (
            <button type="button" className="shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold" onClick={onChangeContext}>
              change
            </button>
          ) : null}
        </div>
      )}
      <div className="mt-3 flex gap-1.5">
        {labels.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={cn("h-1.5 rounded-full", i <= current ? "bg-white" : "bg-white/30")} />
            <div className={cn("mt-1 text-[11px] font-medium", i === current ? "text-white" : "text-white/60")}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Thumb-zone CTA pinned above the bottom edge while scrolling. */
export function StickyCta({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-10 pt-2">
      {children}
    </div>
  );
}
