import { cn } from "../../lib/cn.ts";

/** Brand spinner for in-app loading states (boot splash lives in index.html). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-block h-6 w-6 animate-spin rounded-full border-[3px] border-stone-300 border-t-amber-800", className)}
      role="status"
      aria-label="Loading"
    />
  );
}

export function LoadingRow({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
      <Spinner />
      {label}
    </div>
  );
}
