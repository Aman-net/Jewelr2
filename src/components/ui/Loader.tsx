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

/** Shimmer bar for placeholder skeletons. */
export function Bar({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-full bg-stone-200", className)} />;
}

/**
 * Row of shimmer cards — looks like the entry/party cards it will replace,
 * so data arriving doesn't shift pages about.
 */
export function ListSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: Math.max(1, rows) }, (_, i) => (
        <div key={i} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Bar className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3.5 w-2/5" />
              <Bar className="h-3 w-1/4" />
            </div>
            <Bar className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full-page placeholder for detail screens: hero band + readout blocks. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-4">
      <div className="h-24 rounded-3xl bg-stone-900/90 animate-pulse" />
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <Bar className="h-16" />
          <Bar className="h-16" />
          <Bar className="h-16" />
        </div>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <Bar className="h-4 w-1/3" />
        <Bar className="mt-3 h-24" />
      </div>
    </div>
  );
}

export function LoadingRow({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="anim-fade flex items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
      <Spinner />
      {label}
    </div>
  );
}
