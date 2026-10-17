import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { cn } from "../../lib/cn.ts";

/**
 * App-like back: always the screen's declared parent, never history.
 * Predictable like an app — the parent map in lib/nav.ts is the contract.
 *
 * Rendered as a tappable pill (full 44px target, hover/active wash) rather than
 * bare text, so it reads as a control on a phone. Callers on dark surfaces pass
 * their own colours — cn() is tailwind-merge, so they win.
 */
export function BackButton({ fallback, label = "Back", className }: {
  fallback: string;
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(fallback, { replace: true })}
      className={cn(
        "inline-flex min-h-11 items-center gap-0.5 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-amber-800 transition-[color,background-color,transform] duration-150 hover:bg-amber-100/70 active:scale-95 active:bg-amber-100",
        className,
      )}
    >
      <ChevronLeft size={20} strokeWidth={2.5} aria-hidden className="-ml-0.5 transition-transform duration-150 active:-translate-x-0.5" />
      {label}
    </button>
  );
}
