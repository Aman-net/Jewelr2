import { cn } from "../../lib/cn.ts";

const TONES: Record<string, string> = {
  SALE: "bg-amber-100 text-amber-900",
  PURCHASE: "bg-sky-100 text-sky-900",
  RECEIPT: "bg-emerald-100 text-emerald-900",
  PAYMENT: "bg-orange-100 text-orange-900",
  CONVERSION: "bg-violet-100 text-violet-900",
  OPENING: "bg-stone-200 text-stone-700",
  ADJUSTMENT: "bg-stone-200 text-stone-700",
  REVERSAL: "bg-red-100 text-red-900",
};

/** Small colored voucher-type tag, shared by khata rows and activity feeds. */
export function TypeTag({ type, className }: { type: string; className?: string }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold", TONES[type] ?? "bg-stone-100 text-stone-600", className)}>
      {type}
    </span>
  );
}

/** Role tags for a party: Customer and/or Supplier pills. */
export function RoleTags({ isCustomer, isSupplier }: { isCustomer: boolean; isSupplier: boolean }) {
  return (
    <span className="inline-flex gap-1">
      {isCustomer && (
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-900">Customer</span>
      )}
      {isSupplier && (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold text-violet-900">Supplier</span>
      )}
    </span>
  );
}

/**
 * Metal identity tag — gold/amber, silver/slate — used everywhere a metal
 * appears, so the operator reads metal by color before reading words.
 */
export function MetalTag({ metal, className }: { metal: "GOLD" | "SILVER"; className?: string }) {
  const gold = metal === "GOLD";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
      gold ? "bg-amber-200 text-amber-900" : "bg-slate-200 text-slate-700",
      className,
    )}>
      <span className={cn("h-1.5 w-1.5 rounded-full", gold ? "bg-amber-600" : "bg-slate-500")} />
      {gold ? "Gold" : "Silver"}
    </span>
  );
}
