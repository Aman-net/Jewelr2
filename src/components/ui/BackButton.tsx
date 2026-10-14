import { useNavigate } from "react-router";

/**
 * App-like back: one step back in history, or to a safe fallback when the
 * screen was deep-linked (no history to go back to).
 */
export function BackButton({ fallback, label = "Back" }: { fallback: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="text-sm font-semibold text-amber-800 active:opacity-70"
      onClick={() => {
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
        if (idx > 0) navigate(-1);
        else navigate(fallback, { replace: true });
      }}
    >
      ‹ {label}
    </button>
  );
}
