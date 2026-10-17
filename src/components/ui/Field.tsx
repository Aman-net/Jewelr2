import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn.ts";

const controlClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 placeholder:text-stone-400 focus:border-amber-700 focus:outline-none focus:ring-1 focus:ring-amber-700";

export function Field({ label, unit, error, hint, children }: {
  label: string;
  unit?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between text-sm font-medium text-stone-700">
        <span>{label}</span>
        {unit ? <span className="text-xs font-normal text-stone-500">{unit}</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-stone-500">{hint}</span> : null}
      {error ? <span className="mt-1 block text-xs font-medium text-red-700">{error}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlClass, props.className)} />;
}

/** Text input with a leading magnifier — one shape for every search box. */
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input {...props} className={cn(controlClass, "pl-9", props.className)} />
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlClass, props.className)} />;
}

export function CheckRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-stone-300 bg-white px-3">
      <span className="text-base text-stone-900">{label}</span>
      {children}
    </label>
  );
}

/** Indian grouping for a digit string: 100000 -> "1,00,000". */
function groupIntDigits(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(",")},${last3}`;
}

/** Big tactile amount input with a unit prefix (₹/g/%) for hero fields. Groups digits live (Indian grouping) with caret-safe editing. */
export function AmountInput({ prefix, className, onChange, ...props }: InputHTMLAttributes<HTMLInputElement> & { prefix: string }) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const old = el.value;
    const caret = el.selectionStart ?? old.length;
    const atEnd = caret >= old.length;
    const noCommas = el.value.replace(/,/g, "");
    const dot = noCommas.indexOf(".");
    const intDigits = (dot === -1 ? noCommas : noCommas.slice(0, dot)).replace(/[^0-9]/g, "");
    const dec = dot === -1 ? "" : `.${noCommas.slice(dot + 1).replace(/\./g, "")}`;
    el.value = `${groupIntDigits(intDigits)}${dec}`;
    if (atEnd) {
      el.setSelectionRange(el.value.length, el.value.length);
      onChange?.(e);
      return;
    }
    const digitsBefore = old.slice(0, caret).replace(/[^0-9]/g, "").length;
    let seen = 0;
    let pos = 0;
    while (pos < el.value.length && seen < digitsBefore) {
      if (/[0-9]/.test(el.value[pos] ?? "")) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    onChange?.(e);
  };
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-stone-400">
        {prefix}
      </span>
      <input
        {...props}
        onChange={handleChange}
        className={cn(controlClass, "py-3 pl-10 text-2xl font-bold tracking-tight", className)}
      />
    </div>
  );
}
