import { useMemo } from "react";
import { cn } from "../../lib/cn.ts";

/** Deterministic initials + hue from a party name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

const HUES = [262, 210, 160, 24, 340, 190, 280, 12];

export function hueOf(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)!) >>> 0;
  return HUES[h % HUES.length] ?? 262;
}

export function PartyAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const style = useMemo(
    () => ({ background: `linear-gradient(135deg, hsl(${hueOf(name)} 45% 55%), hsl(${hueOf(name)} 50% 38%))` }),
    [name],
  );
  return (
    <div
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-white",
        size === "lg" ? "h-14 w-14 text-xl" : "h-11 w-11 text-base",
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}
