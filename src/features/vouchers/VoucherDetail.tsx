import Decimal from "decimal.js";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Pencil, Undo2 } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Bits.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { LoadingRow } from "../../components/ui/Loader.tsx";
import { Field, Textarea } from "../../components/ui/Field.tsx";
import { toneForVoucher } from "../../components/ui/Flow.tsx";
import { TypeTag, MetalTag } from "../../components/ui/TypeTag.tsx";
import { db, getVoucher, reverseVoucher } from "../../data/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { formatGram, formatINR, formatRate, formatTime, formatTunch } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";
import type { SalePurchaseLine } from "../../domain/index.ts";

const mgToG = (mg: number) => new Decimal(mg).div(1000).toString();
const scaledToPct = (s: number) => new Decimal(s).div(100).toString();
const paiseToRs = (p: number) => new Decimal(p).div(100).toString();

function lineToPrefill(l: SalePurchaseLine) {
  return {
    metal: l.metalType,
    category: l.categoryName,
    itemCount: l.itemCount ? String(l.itemCount) : "",
    physicalG: mgToG(l.physicalMg),
    recordedTunch: l.recordedTunchScaled !== undefined ? scaledToPct(l.recordedTunchScaled) : "",
    agreedTunch: scaledToPct(l.agreedTunchScaled),
    mode: l.pricingMode,
    rate: l.rateAmountPaise !== undefined ? paiseToRs(l.rateAmountPaise) : "",
    labourMode: l.labourMode ?? "",
    labourRate: l.labourRatePaise !== undefined ? paiseToRs(l.labourRatePaise) : "",
  };
}

function labourLine(l: SalePurchaseLine): string | null {
  if (l.labourPaise <= 0) return null;
  if (l.labourMode === "PER_PIECE") {
    return `Labour (${l.itemCount ?? "?"} pcs × ${formatINR(l.labourRatePaise ?? 0)})`;
  }
  return `Labour (${formatGram(l.physicalMg)} × ${formatINR(l.labourRatePaise ?? 0)}/kg)`;
}

export function VoucherDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const stored = useLiveQuery(() => getVoucher(id), [id]);
  const reversal = useLiveQuery(() => db.vouchers.where("reversesVoucherId").equals(id).first(), [id]);
  const [showReverse, setShowReverse] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const partyList = usePartyList();

  if (stored === undefined) return <Page title=""><LoadingRow /></Page>;
  if (!stored) return <Page title="Voucher"><Card><p className="text-sm text-stone-500">Voucher not found.</p></Card></Page>;
  const { voucher: v, entry: e } = stored;
  const partyName = (partyList ?? []).find((p) => p.id === v.partyId)?.name ?? "";
  const reversible = v.type !== "REVERSAL" && !reversal;
  const tone = toneForVoucher(v.type);
  const toneBg: Record<string, string> = {
    amber: "from-amber-600 to-amber-800",
    sky: "from-sky-600 to-sky-800",
    emerald: "from-emerald-600 to-emerald-800",
    orange: "from-orange-600 to-orange-800",
    violet: "from-violet-600 to-violet-800",
    stone: "from-stone-700 to-stone-900",
  };

  const doReverse = async () => {
    if (!reason.trim()) {
      setError("A reason is required — corrections must preserve history.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await reverseVoucher(id, reason.trim());
      setShowReverse(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reverse");
    } finally {
      setBusy(false);
    }
  };

  const doCorrect = async () => {
    if (!reason.trim()) {
      setError("Enter the reason first — it will travel with both vouchers.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await reverseVoucher(id, reason.trim());
      const base = { correctedFrom: id, reason: reason.trim(), partyId: v.partyId, businessDate: v.businessDate };
      if (v.type === "SALE" || v.type === "PURCHASE") {
        navigate(`/vouchers/new/${v.type.toLowerCase()}`, {
          state: {
            prefill: {
              ...base,
              lines: v.lines.map(lineToPrefill),
              misc: v.misc.map((m) => ({ label: m.label, amount: paiseToRs(m.cashPaise) })),
            },
          },
        });
      } else if (v.type === "RECEIPT" || v.type === "PAYMENT") {
        const s = v.settlement;
        navigate(`/vouchers/new/${v.type.toLowerCase()}`, {
          state: {
            correctedFrom: id,
            prefill: s
              ? {
                  partyId: v.partyId,
                  businessDate: v.businessDate,
                  cash: s.cashPaise ? paiseToRs(s.cashPaise) : "",
                  goldG: s.goldPhysicalMg ? mgToG(s.goldPhysicalMg) : "",
                  goldTunch: s.goldTunchScaled !== undefined ? scaledToPct(s.goldTunchScaled) : "",
                  silverG: s.silverPhysicalMg ? mgToG(s.silverPhysicalMg) : "",
                  silverTunch: s.silverTunchScaled !== undefined ? scaledToPct(s.silverTunchScaled) : "",
                  paymentMode: s.paymentMode ?? "",
                }
              : undefined,
          },
        });
      } else if (v.type === "CONVERSION" && v.conversion) {
        const c = v.conversion;
        navigate("/vouchers/new/conversion", {
          state: {
            correctedFrom: id,
            prefill: {
              partyId: v.partyId,
              businessDate: v.businessDate,
              direction: c.direction,
              metal: c.metalType,
              side: c.side,
              fineG: mgToG(c.fineMg),
              rate: paiseToRs(c.rateAmountPaise),
            },
          },
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not correct");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="" backTo={`/parties/${v.partyId}`} backLabel="Khata">
      <div className={cn("rounded-3xl bg-gradient-to-br p-5 text-white shadow-md", toneBg[tone])}>
        <div className="flex items-center gap-2">
          <TypeTag type={v.type} className="bg-white/25 text-white" />
          {reversal ? (
            <span className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] font-bold uppercase">Reversed</span>
          ) : (
            <span className="rounded bg-black/30 px-1.5 py-0.5 text-[11px] font-bold uppercase">Active</span>
          )}
        </div>
        <Link to={`/parties/${v.partyId}`} className="mt-2 block truncate text-2xl font-bold tracking-tight">
          {partyName || "Open khata"} ›
        </Link>
        <div className="mt-1 text-sm text-white/85">
          {v.businessDate}{v.referenceNumber ? ` · Bill ${v.referenceNumber}` : ""}
        </div>
        <div className="mt-0.5 text-xs text-white/70">Recorded {formatTime(v.createdAt)}</div>
      </div>
      <Card>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Ledger change</div>
        <BalanceGrid cashPaise={e.cashDeltaPaise} goldFineMg={e.goldFineDeltaMg} silverFineMg={e.silverFineDeltaMg} />
        {v.notes ? <div className="mt-2 border-t border-dashed border-stone-200 pt-2 text-sm text-stone-700">{v.notes}</div> : null}
      </Card>
      {(v.lines.length > 0 || v.settlement || v.conversion) && (
        <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
            Breakdown
          </div>
          {v.lines.map((l, i) => (
            <div key={l.id} className="border-b border-dashed border-stone-200 px-4 py-3 last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-base font-bold text-stone-900">#{i + 1} {l.categoryName}</span>
                <MetalTag metal={l.metalType} />
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto_1.2fr] items-stretch gap-1 text-center">
                <div className="rounded-xl bg-stone-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-stone-900">{formatGram(l.physicalMg)}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-stone-500">weight</div>
                </div>
                <div className="self-center text-sm font-bold text-stone-400">×</div>
                <div className="rounded-xl bg-stone-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-stone-900">{formatTunch(l.agreedTunchScaled)}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-stone-500">agreed</div>
                </div>
                <div className="self-center text-sm font-bold text-stone-400">=</div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-emerald-900">{formatGram(l.fineMg)}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wide text-emerald-700">fine</div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <span className="text-sm text-stone-600">
                  {l.pricingMode === "CASH_AT_RATE" ? "Party owes" : "Owes metal"}
                </span>
                {l.pricingMode === "CASH_AT_RATE" ? (
                  <span className="text-lg font-bold tracking-tight text-stone-900">
                    {formatINR(l.lineCashPaise + l.labourPaise)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-stone-700">rate fixed later</span>
                )}
              </div>
              {l.pricingMode === "CASH_AT_RATE" && l.rateAmountPaise !== undefined && l.rateUnit && (
                <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-sm text-stone-600">
                  <span>Rate agreed</span>
                  <span className="font-semibold text-stone-900">{formatRate(l.rateAmountPaise, l.rateUnit)}</span>
                </div>
              )}
              {(() => {
                const labour = labourLine(l);
                return labour ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-sm font-semibold text-stone-700">
                    <span>{labour}</span>
                    <span>{formatINR(l.labourPaise)}</span>
                  </div>
                ) : null;
              })()}
            </div>
          ))}
          {v.settlement && (
            <div className="border-b border-dashed border-stone-200 px-4 py-3 last:border-0">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Settlement</div>
              {(v.settlement.cashPaise ?? 0) > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                  <span className="text-sm text-stone-600">Cash</span>
                  <span className="text-lg font-bold tracking-tight text-stone-900">{formatINR(v.settlement.cashPaise ?? 0)}</span>
                </div>
              )}
              {v.settlement.goldFineMg > 0 && (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="text-sm text-stone-600">
                    Gold {v.settlement.goldPhysicalMg ? `${formatGram(v.settlement.goldPhysicalMg)} × ${formatTunch(v.settlement.goldTunchScaled ?? 0)}` : ""}
                  </span>
                  <span className="text-sm font-bold text-amber-700">{formatGram(v.settlement.goldFineMg)} fine</span>
                </div>
              )}
              {v.settlement.silverFineMg > 0 && (
                <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2">
                  <span className="text-sm text-stone-600">
                    Silver {v.settlement.silverPhysicalMg ? `${formatGram(v.settlement.silverPhysicalMg)} × ${formatTunch(v.settlement.silverTunchScaled ?? 0)}` : ""}
                  </span>
                  <span className="text-sm font-bold text-slate-600">{formatGram(v.settlement.silverFineMg)} fine</span>
                </div>
              )}
              {v.settlement.paymentMode ? (
                <div className="mt-1.5">
                  <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-[11px] font-bold text-stone-700">via {v.settlement.paymentMode}</span>
                </div>
              ) : null}
            </div>
          )}
          {v.conversion && (
            <div className="px-4 py-2.5 text-sm text-stone-700">
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-bold text-stone-700">
                {v.conversion.side === "PARTY_OWES" ? "Party owes" : "We owe"}
              </span>{" "}
              {v.conversion.direction === "METAL_TO_CASH" ? "Metal → cash" : "Cash → metal"} ·{" "}
              <b>{formatGram(v.conversion.fineMg)}</b> {v.conversion.metalType} ⇄ <b>{formatINR(v.conversion.cashPaise)}</b>
              <div className="mt-1 text-stone-600">
                Rate agreed <b className="text-stone-900">{formatRate(v.conversion.rateAmountPaise, v.conversion.rateUnit)}</b>
              </div>
            </div>
          )}
          {v.misc.length > 0 && (
            <div className="border-t border-dashed border-stone-200 px-4 py-2.5 text-sm text-stone-700">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Extra charges</div>
              {v.misc.map((m) => (
                <div key={m.label} className="flex justify-between gap-2">
                  <span>{m.label}</span>
                  <b>{formatINR(m.cashPaise)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {v.type === "REVERSAL" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-stone-700">
          Reverses <Link to={`/vouchers/${v.reversesVoucherId}`} className="font-semibold text-red-800">original ›</Link>
          <div className="mt-1">Reason: {v.reversalReason}</div>
        </div>
      )}
      {reversal && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-stone-700">
          {en.voucher.reversedBy} <Link to={`/vouchers/${reversal.id}`} className="font-semibold text-red-800">reversal ›</Link>
        </div>
      )}
      <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
        <summary className="cursor-pointer text-xs font-medium text-stone-400">Record details</summary>
        <div className="pt-1 text-xs text-stone-500">
          Posted {new Date(v.createdAt).toLocaleString("en-IN")} · rules {v.calculationVersion}
        </div>
      </details>
      {reversible && !showReverse && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Button variant="secondary" full onClick={() => setShowReverse(true)} className="min-h-12">
              <Undo2 size={18} /> {en.voucher.reverse}
            </Button>
          </div>
          {(v.type === "SALE" || v.type === "PURCHASE" || v.type === "RECEIPT" || v.type === "PAYMENT" || v.type === "CONVERSION") && (
            <div className="flex-1">
              <Button variant="secondary" full onClick={() => setShowReverse(true)} className="min-h-12">
                <Pencil size={18} /> {en.voucher.correct}
              </Button>
            </div>
          )}
        </div>
      )}
      {reversible && showReverse && (
        <Sheet title={`${en.voucher.reverse} / ${en.voucher.correct}`} onClose={() => { setShowReverse(false); setError(""); }}>
          <div className="flex flex-col gap-3">
            <Field label={en.voucher.reason}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. wrong tunch written" autoFocus />
            </Field>
            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
            <Button variant="danger" full onClick={doReverse} disabled={busy} className="min-h-12">
              <Undo2 size={18} /> {en.voucher.reverse} only
            </Button>
            <Button full onClick={doCorrect} disabled={busy} className="min-h-12">
              <Pencil size={18} /> {en.voucher.correct} (reverse + new)
            </Button>
          </div>
        </Sheet>
      )}
    </Page>
  );
}
