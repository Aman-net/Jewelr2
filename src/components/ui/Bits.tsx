import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/** Selectable pill — tunch shortcuts, metals, billing modes. Big touch target. */
export function Chip({ selected, onClick, children, className }: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-4 text-sm font-medium transition-colors active:scale-95",
        selected
          ? "border-amber-800 bg-amber-800 text-white"
          : "border-stone-300 bg-white text-stone-700",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** 3-step wizard progress: Party → Details → Review. */
export function Steps({ current, labels }: { current: number; labels: [string, string, string] }) {
  return (
    <div className="flex items-center gap-1" aria-label="Progress">
      {labels.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-1 last:flex-none">
            <div className="flex flex-1 flex-col gap-1">
              <div
                className={cn(
                  "h-1.5 rounded-full",
                  done || active ? "bg-amber-700" : "bg-stone-200",
                )}
              />
              <span className={cn("text-[11px] font-medium", active ? "text-amber-900" : "text-stone-400")}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Bottom sheet for pickers and confirmations. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fade-in fixed inset-0 z-20 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="sheet-panel max-h-[85svh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <div className="mb-3 text-base font-semibold text-stone-900">{title}</div>
        {children}
      </div>
    </div>
  );
}

/** Empty state with guidance instead of a dead blank card. */
export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-center">
      <div className="text-sm font-medium text-stone-700">{title}</div>
      <div className="mt-1 text-sm text-stone-500">{hint}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Section divider: separates stacked blocks so cards don't read as one list. */
export function SectionLabel({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-1 pt-1">
      <span className="text-xs font-semibold uppercase tracking-widest text-stone-500">{children}</span>
      {note !== undefined && note !== null ? <span className="text-xs tabular-nums text-stone-400">{note}</span> : null}
    </div>
  );
}
