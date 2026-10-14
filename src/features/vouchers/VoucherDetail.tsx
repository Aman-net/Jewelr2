import Decimal from "decimal.js";
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { Field, Textarea } from "../../components/ui/Field.tsx";
import { db, getVoucher, reverseVoucher } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";
import { formatGram, formatINR, formatTunch } from "../../lib/format.ts";
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
    labour: l.labourPaisePerGram !== undefined ? paiseToRs(l.labourPaisePerGram) : "",
  };
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

  if (stored === undefined) return <Page title=""><Card><p className="text-sm text-stone-500">Loading…</p></Card></Page>;
  if (!stored) return <Page title="Voucher"><Card><p className="text-sm text-stone-500">Voucher not found.</p></Card></Page>;
  const { voucher: v, entry: e } = stored;
  const reversible = v.type !== "REVERSAL" && !reversal;

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
          state: { prefill: { ...base, lines: v.lines.map(lineToPrefill) } },
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
    <Page
      title={`${v.type.charAt(0)}${v.type.slice(1).toLowerCase()}`}
      action={<Link to={`/parties/${v.partyId}/ledger`} className="text-sm font-medium text-amber-800">Ledger ›</Link>}
    >
      <Card>
        <div className="mb-1 text-sm text-stone-500">{v.businessDate}{v.referenceNumber ? ` · Ref ${v.referenceNumber}` : ""}</div>
        <BalanceGrid cashPaise={e.cashDeltaPaise} goldFineMg={e.goldFineDeltaMg} silverFineMg={e.silverFineDeltaMg} />
        {v.notes ? <div className="mt-2 text-sm text-stone-700">{v.notes}</div> : null}
      </Card>
      {v.lines.map((l, i) => (
        <Card key={l.id}>
          <div className="text-sm font-medium text-stone-900">Line {i + 1} · {l.metalType} · {l.categoryName}</div>
          <div className="mt-1 text-sm text-stone-700">
            {formatGram(l.physicalMg)} at {formatTunch(l.agreedTunchScaled)} → fine {formatGram(l.fineMg)}
            {l.pricingMode === "CASH_AT_RATE" ? ` · ${formatINR(l.lineCashPaise)}` : " · rate open"}
            {l.labourPaise > 0 ? ` · labour ${formatINR(l.labourPaise)}` : ""}
          </div>
        </Card>
      ))}
      {v.settlement && (
        <Card>
          <div className="text-sm text-stone-700">
            {(v.settlement.cashPaise ?? 0) > 0 ? `Cash ${formatINR(v.settlement.cashPaise ?? 0)} ` : ""}
            {v.settlement.goldFineMg > 0 ? `Gold ${formatGram(v.settlement.goldFineMg)} ` : ""}
            {v.settlement.silverFineMg > 0 ? `Silver ${formatGram(v.settlement.silverFineMg)} ` : ""}
            {v.settlement.paymentMode ? `· ${v.settlement.paymentMode}` : ""}
          </div>
        </Card>
      )}
      {v.conversion && (
        <Card>
          <div className="text-sm text-stone-700">
            {formatGram(v.conversion.fineMg)} {v.conversion.metalType} ⇄ {formatINR(v.conversion.cashPaise)}
          </div>
        </Card>
      )}
      {v.type === "REVERSAL" && (
        <Card>
          <div className="text-sm text-stone-700">
            Reverses <Link to={`/vouchers/${v.reversesVoucherId}`} className="font-medium text-amber-800">original ›</Link>
            <div>Reason: {v.reversalReason}</div>
          </div>
        </Card>
      )}
      {reversal && (
        <Card>
          <div className="text-sm text-stone-700">
            {en.voucher.reversedBy} <Link to={`/vouchers/${reversal.id}`} className="font-medium text-amber-800">reversal ›</Link>
          </div>
        </Card>
      )}
      <Card>
        <div className="text-xs text-stone-500">
          Calculation {v.calculationVersion} · posted {new Date(v.createdAt).toLocaleString("en-IN")}
        </div>
      </Card>
      {reversible && !showReverse && (
        <div className="flex gap-2">
          <div className="flex-1"><Button variant="secondary" full onClick={() => setShowReverse(true)}>{en.voucher.reverse}</Button></div>
          {(v.type === "SALE" || v.type === "PURCHASE" || v.type === "RECEIPT" || v.type === "PAYMENT" || v.type === "CONVERSION") && (
            <div className="flex-1"><Button variant="secondary" full onClick={() => setShowReverse(true)}>{en.voucher.correct}</Button></div>
          )}
        </div>
      )}
      {reversible && showReverse && (
        <Card>
          <div className="flex flex-col gap-3">
            <Field label={en.voucher.reason}>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. wrong tunch written" />
            </Field>
            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
            <div className="flex gap-2">
              <div className="flex-1"><Button variant="secondary" full onClick={() => { setShowReverse(false); setError(""); }}>{en.common.cancel}</Button></div>
              <div className="flex-1"><Button variant="danger" full onClick={doReverse} disabled={busy}>{en.voucher.reverse}</Button></div>
              <div className="flex-1"><Button full onClick={doCorrect} disabled={busy}>{en.voucher.correct}</Button></div>
            </div>
          </div>
        </Card>
      )}
    </Page>
  );
}
