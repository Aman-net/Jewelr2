import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button.tsx";

/**
 * Post-success screen: what just happened + where to go next. The mark pops
 * with one soft pulse, then the copy and actions settle in a beat behind it
 * — arrival and next-step read as one motion, not four separate pop-ins.
 */
export function SuccessView({ title, summary, primary, secondary }: {
  title: string;
  summary: ReactNode;
  primary: { label: string; onClick: () => void };
  secondary: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="ring-pulse relative inline-flex">
        <CheckCircle2 className="pop-in text-emerald-600" size={64} strokeWidth={1.5} />
      </span>
      <div className="anim-rise text-lg font-semibold text-stone-900" style={{ animationDelay: "80ms" }}>
        {title}
      </div>
      <div className="anim-rise w-full" style={{ animationDelay: "140ms" }}>{summary}</div>
      <div className="anim-rise flex w-full gap-2" style={{ animationDelay: "200ms" }}>
        <div className="flex-1"><Button variant="secondary" full onClick={secondary.onClick}>{secondary.label}</Button></div>
        <div className="flex-1"><Button full onClick={primary.onClick}>{primary.label}</Button></div>
      </div>
    </div>
  );
}
