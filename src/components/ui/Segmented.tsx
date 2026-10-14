import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/** iOS-style segmented control for 2–3 exclusive options. Replaces dropdowns. */
export function Segmented<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, ReactNode>>;
}) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-stone-200 p-1">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "min-h-10 rounded-lg px-2 text-sm font-semibold transition-all active:scale-95",
            value === o ? "bg-white text-stone-900 shadow-sm" : "text-stone-500",
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
