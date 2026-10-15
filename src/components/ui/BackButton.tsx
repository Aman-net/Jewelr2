import { useNavigate } from "react-router";

/**
 * App-like back: always the screen's declared parent, never history.
 * Predictable like an app — the parent map in lib/nav.ts is the contract.
 */
export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="text-sm font-semibold text-amber-800 active:opacity-70"
      onClick={() => navigate(fallback, { replace: true })}
    >
      ‹ {label}
    </button>
  );
}
