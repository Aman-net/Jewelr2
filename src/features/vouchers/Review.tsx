import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card } from "../../components/ui/Card.tsx";
import type { Voucher } from "../../domain/index.ts";
import { formatGram, formatINR, formatTunch } from "../../lib/format.ts";
import { en } from "../../i18n/en.ts";

/** Review-before-post: every calculation, then explicit confirmation. */
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
  return (
    <div className="flex flex-col gap-3">
      <Card>
        <div className="mb-1 text-sm text-stone-500">{voucher.type} · {voucher.businessDate} · {partyName}</div>
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Resulting ledger change</div>
        <BalanceGrid cashPaise={cash} goldFineMg={gold} silverFineMg={silver} />
      </Card>
      {voucher.lines.map((l, i) => (
        <Card key={l.id}>
          <div className="text-sm font-medium text-stone-900">Line {i + 1} · {l.metalType} · {l.categoryName}</div>
          <div className="mt-1 flex flex-col gap-0.5 text-sm text-stone-700">
            <div>Weight {formatGram(l.physicalMg)} at agreed {formatTunch(l.agreedTunchScaled)} → fine {formatGram(l.fineMg)}</div>
            {l.pricingMode === "CASH_AT_RATE"
              ? <div>Value {formatINR(l.lineCashPaise)}</div>
              : <div>Rate open — owes metal</div>}
            {l.labourPaise > 0 && <div>Labour {formatINR(l.labourPaise)}</div>}
          </div>
        </Card>
      ))}
      {voucher.settlement && (
        <Card>
          <div className="text-sm font-medium text-stone-900">Settlement</div>
          <div className="mt-1 flex flex-col gap-0.5 text-sm text-stone-700">
            {(voucher.settlement.cashPaise ?? 0) > 0 && <div>Cash {formatINR(voucher.settlement.cashPaise ?? 0)}</div>}
            {voucher.settlement.goldFineMg > 0 && <div>Gold fine {formatGram(voucher.settlement.goldFineMg)}</div>}
            {voucher.settlement.silverFineMg > 0 && <div>Silver fine {formatGram(voucher.settlement.silverFineMg)}</div>}
            {voucher.settlement.paymentMode && <div>Mode {voucher.settlement.paymentMode}</div>}
          </div>
        </Card>
      )}
      {voucher.conversion && (
        <Card>
          <div className="text-sm font-medium text-stone-900">
            Conversion {voucher.conversion.direction === "METAL_TO_CASH" ? "metal → cash" : "cash → metal"}
          </div>
          <div className="mt-1 text-sm text-stone-700">
            {formatGram(voucher.conversion.fineMg)} {voucher.conversion.metalType} ⇄ {formatINR(voucher.conversion.cashPaise)}
          </div>
        </Card>
      )}
      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <div className="flex-1"><Button variant="secondary" full onClick={onBack}>{en.voucher.back}</Button></div>
        <div className="flex-1"><Button full onClick={onConfirm} disabled={posting}>{posting ? "Posting…" : en.voucher.confirm}</Button></div>
      </div>
    </div>
  );
}
