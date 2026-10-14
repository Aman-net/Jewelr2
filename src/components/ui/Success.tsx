import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button.tsx";

/** Post-success screen: what just happened + where to go next. */
export function SuccessView({ title, summary, primary, secondary }: {
  title: string;
  summary: ReactNode;
  primary: { label: string; onClick: () => void };
  secondary: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle2 size={64} className="pop-in text-emerald-600" strokeWidth={1.5} />
      <div className="text-lg font-semibold text-stone-900">{title}</div>
      <div className="w-full">{summary}</div>
      <div className="flex w-full gap-2">
        <div className="flex-1"><Button variant="secondary" full onClick={secondary.onClick}>{secondary.label}</Button></div>
        <div className="flex-1"><Button full onClick={primary.onClick}>{primary.label}</Button></div>
      </div>
    </div>
  );
}
