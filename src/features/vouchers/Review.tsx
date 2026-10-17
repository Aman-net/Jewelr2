import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid } from "../../components/ui/Card.tsx";
import { MetalTag } from "../../components/ui/TypeTag.tsx";
import type { SalePurchaseLine, Voucher } from "../../domain/index.ts";
import { formatGram, formatINR, formatRate, formatTunch } from "../../lib/format.ts";
import { en } from "../../i18n/en.ts";
import { cn } from "../../lib/cn.ts";

const DOT: Record<string, string> = {
  SALE: "bg-amber-600",
  PURCHASE: "bg-sky-600",
  RECEIPT: "bg-emerald-600",
  PAYMENT: "bg-orange-600",
  CONVERSION: "bg-violet-600",
  OPENING: "bg-stone-600",
  ADJUSTMENT: "bg-stone-500",
  REVERSAL: "bg-red-600",
};

/** Human basis for a stored labour snapshot: "(4 pcs × ₹25)" / "(100 g × ₹50/kg)". */
function labourBasis(l: SalePurchaseLine): string {
  if (l.labourMode === "PER_PIECE") {
    return ` (${l.itemCount ?? "?"} pcs × ${formatINR(l.labourRatePaise ?? 0)})`;
  }
  if (l.labourMode === "PER_KG") {
    return ` (${formatGram(l.physicalMg)} × ${formatINR(l.labourRatePaise ?? 0)}/kg)`;
  }
  return "";
}

/** Review-before-post as a shop receipt: dashed sections, explicit totals. */
export function Review({ voucher, cash, gold, silver, partyName, posting, error, onBack, onConfirm }: {
  voucher: Voucher;
  cash: number;
  gold: number;
  silver: number;
  partyName: string;
  posting: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const typeName = (en.voucher as Record<string, string>)[voucher.type.toLowerCase()] ?? voucher.type;
  return (
    <div className="flex flex-col gap-3">
      <div className="anim-fade overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 p-4 pb-3">
          <span className={cn("h-3 w-3 shrink-0 rounded-full", DOT[voucher.type] ?? "bg-stone-400")} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-stone-900">{typeName} · {partyName}</div>
            <div className="text-xs text-stone-500">{voucher.businessDate}{voucher.referenceNumber ? ` · Bill ${voucher.referenceNumber}` : ""}</div>
          </div>
        </div>
        <div className="border-t border-dashed border-stone-300 px-4 py-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Ledger change</div>
          <BalanceGrid cashPaise={cash} goldFineMg={gold} silverFineMg={silver} />
        </div>
        {voucher.lines.map((l, i) => (
          <div key={l.id} className="border-t border-dashed border-stone-300 px-4 py-2.5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-stone-900">
              <span>{i + 1}.</span><MetalTag metal={l.metalType} /><span>{l.categoryName}</span>
            </div>
            <div className="mt-0.5 text-stone-600">
              {formatGram(l.physicalMg)} × {formatTunch(l.agreedTunchScaled)} → <b>{formatGram(l.fineMg)}</b> fine
            </div>
            <div className="text-stone-600">
              {l.pricingMode === "CASH_AT_RATE" ? <b>{formatINR(l.lineCashPaise)}</b> : "Owes metal — rate fixed later"}
              {l.labourPaise > 0 ? <> · labour {formatINR(l.labourPaise)}{labourBasis(l)}</> : null}
            </div>
            {l.pricingMode === "CASH_AT_RATE" && l.rateAmountPaise !== undefined && l.rateUnit && (
              <div className="text-stone-600">
                Rate agreed <b className="text-stone-900">{formatRate(l.rateAmountPaise, l.rateUnit)}</b>
              </div>
            )}
          </div>
        ))}
        {voucher.settlement && (
          <div className="border-t border-dashed border-stone-300 px-4 py-2.5 text-sm text-stone-700">
            {(voucher.settlement.cashPaise ?? 0) > 0 && <div>Cash <b>{formatINR(voucher.settlement.cashPaise ?? 0)}</b></div>}
            {voucher.settlement.goldFineMg > 0 && (
              <div>
                Gold <b>{formatGram(voucher.settlement.goldFineMg)}</b> fine
                {voucher.settlement.goldPhysicalMg ? (
                  <span className="text-stone-500"> ({formatGram(voucher.settlement.goldPhysicalMg)} × {formatTunch(voucher.settlement.goldTunchScaled ?? 0)})</span>
                ) : null}
              </div>
            )}
            {voucher.settlement.silverFineMg > 0 && (
              <div>
                Silver <b>{formatGram(voucher.settlement.silverFineMg)}</b> fine
                {voucher.settlement.silverPhysicalMg ? (
                  <span className="text-stone-500"> ({formatGram(voucher.settlement.silverPhysicalMg)} × {formatTunch(voucher.settlement.silverTunchScaled ?? 0)})</span>
                ) : null}
              </div>
            )}
            {voucher.settlement.paymentMode && <div className="text-stone-500">via {voucher.settlement.paymentMode}</div>}
          </div>
        )}
        {voucher.conversion && (
          <div className="border-t border-dashed border-stone-300 px-4 py-2.5 text-sm text-stone-700">
            {voucher.conversion.side === "PARTY_OWES" ? "Party owes" : "We owe"} ·{" "}
            {voucher.conversion.direction === "METAL_TO_CASH" ? "Metal → cash" : "Cash → metal"} ·{" "}
            <b>{formatGram(voucher.conversion.fineMg)}</b> {voucher.conversion.metalType} ⇄ <b>{formatINR(voucher.conversion.cashPaise)}</b>
            <div className="text-stone-600">
              Rate agreed <b className="text-stone-900">{formatRate(voucher.conversion.rateAmountPaise, voucher.conversion.rateUnit)}</b>
            </div>
          </div>
        )}
        {voucher.misc.length > 0 && (
          <div className="border-t border-dashed border-stone-300 px-4 py-2.5 text-sm text-stone-700">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Extra charges</div>
            {voucher.misc.map((m) => (
              <div key={m.label} className="flex justify-between gap-2">
                <span>{m.label}</span>
                <b>{formatINR(m.cashPaise)}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      {error ? <p className="shake text-sm font-medium text-red-700" role="alert">{error}</p> : null}
      <div className="flex gap-2">
        <div className="flex-1"><Button variant="secondary" full onClick={onBack} className="min-h-14 text-lg">{en.voucher.back}</Button></div>
        <div className="flex-[2]">
          <Button full onClick={onConfirm} disabled={posting} className="min-h-14 text-lg shadow-lg">
            {posting ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                {en.voucher.posting}
              </span>
            ) : en.voucher.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
