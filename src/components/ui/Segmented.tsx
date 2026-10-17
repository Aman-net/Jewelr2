import type { ReactNode } from "react";
import { cn } from "../../lib/cn.ts";

/**
 * iOS-style segmented control for 2–4 exclusive options. Replaces dropdowns.
 * The white thumb slides between cells (transform-only, GPU-cheap); buttons
 * sit above it and only their label colour changes. Container is p-1 with
 * gap-1, so thumb step = its own width + one 4px gap — expressed in calc().
 */
export function Segmented<T extends string>({ options, value, onChange, labels }: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, ReactNode>>;
}) {
  const n = options.length;
  const idx = Math.max(0, options.indexOf(value));
  // Container padding: 4px each side → 8px total; cells separated by 4px gaps.
  const trackInner = `100% - ${8 + (n - 1) * 4}px`;
  const cell = `(${trackInner}) / ${n}`;
  return (
    <div className="relative grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-stone-200 p-1" role="tablist">
      <span
        aria-hidden="true"
        className="absolute bottom-1 top-1 left-1 z-0 rounded-lg bg-white shadow-sm transition-transform duration-200 ease-[var(--ease-out)]"
        style={{
          width: `calc(${cell})`,
          transform: `translateX(calc((100% + 4px) * ${idx}))`,
        }}
      />
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={cn(
            "relative z-10 min-h-10 rounded-lg px-2 text-sm font-semibold transition-colors duration-200 active:scale-[0.98]",
            value === o ? "text-stone-900" : "text-stone-500 hover:text-stone-700",
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}
