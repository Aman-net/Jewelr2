import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
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

/** Big tactile amount input with a unit prefix (₹/g/%) for hero fields. */
export function AmountInput({ prefix, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { prefix: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-stone-400">
        {prefix}
      </span>
      <input
        {...props}
        className={cn(controlClass, "py-3 pl-10 text-2xl font-bold tracking-tight", className)}
      />
    </div>
  );
}
