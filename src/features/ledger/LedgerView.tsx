import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Select } from "../../components/ui/Field.tsx";
import { getBalancesAsOf } from "../../data/index.ts";
import type { BalanceDelta, LedgerEntryDelta } from "../../domain/index.ts";
import { useLedgerLive } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { formatGram, formatINR, todayLocal } from "../../lib/format.ts";
import { useLiveQuery } from "dexie-react-hooks";

const typeOptions = ["All", "SALE", "PURCHASE", "RECEIPT", "PAYMENT", "CONVERSION", "OPENING", "ADJUSTMENT", "REVERSAL"] as const;

function RunningRows({ partyId, from, to, type }: { partyId: string; from: string; to: string; type: string }) {
  const entries = useLedgerLive(partyId, {
    from: from || undefined,
    to: to || undefined,
    types: type === "All" ? undefined : [type],
  });
  const rows = useMemo(() => {
    const out: { e: LedgerEntryDelta; bal: BalanceDelta }[] = [];
    const running: BalanceDelta = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
    for (const e of entries ?? []) {
      const bal: BalanceDelta = {
        cashPaise: running.cashPaise + e.cashDeltaPaise,
        goldFineMg: running.goldFineMg + e.goldFineDeltaMg,
        silverFineMg: running.silverFineMg + e.silverFineDeltaMg,
      };
      running.cashPaise = bal.cashPaise;
      running.goldFineMg = bal.goldFineMg;
      running.silverFineMg = bal.silverFineMg;
      out.push({ e, bal });
    }
    return out;
  }, [entries]);
  if (entries === undefined) return <Card><p className="text-sm text-stone-500">Loading…</p></Card>;
  if (rows.length === 0) return <Card><p className="text-sm text-stone-500">No entries in this range.</p></Card>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ e, bal }) => (
        <Link key={e.voucherId} to={`/vouchers/${e.voucherId}`}>
          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-stone-500">{e.businessDate}</span>
              <span className="truncate text-sm font-medium text-stone-900">{e.description}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-sm">
              {e.cashDeltaPaise !== 0 && <span className={e.cashDeltaPaise > 0 ? "text-emerald-700" : "text-red-700"}>{formatINR(e.cashDeltaPaise)}</span>}
              {e.goldFineDeltaMg !== 0 && <span className={e.goldFineDeltaMg > 0 ? "text-emerald-700" : "text-red-700"}>G {formatGram(e.goldFineDeltaMg)}</span>}
              {e.silverFineDeltaMg !== 0 && <span className={e.silverFineDeltaMg > 0 ? "text-emerald-700" : "text-red-700"}>S {formatGram(e.silverFineDeltaMg)}</span>}
            </div>
            <div className="mt-1 border-t border-stone-100 pt-1 text-xs text-stone-500">
              Bal {formatINR(bal.cashPaise)} · G {formatGram(bal.goldFineMg)} · S {formatGram(bal.silverFineMg)}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function AsOf({ partyId }: { partyId: string }) {
  const [date, setDate] = useState(todayLocal());
  const bal = useLiveQuery(
    () => getBalancesAsOf(partyId, date).then((b): BalanceDelta => b),
    [partyId, date],
  );
  return (
    <Card>
      <Field label="Balance as of date">
        <Input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <div className="mt-2">
        <BalanceGrid cashPaise={bal?.cashPaise ?? 0} goldFineMg={bal?.goldFineMg ?? 0} silverFineMg={bal?.silverFineMg ?? 0} />
      </div>
    </Card>
  );
}

export function LedgerPage() {
  const { id = "" } = useParams();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<string>("All");
  return (
    <Page title="Party ledger" action={<Link to={`/parties/${id}`} className="text-sm font-medium text-amber-800">Party ›</Link>}>
      <AsOf partyId={id} />
      <Card>
        <div className="grid grid-cols-3 gap-2">
          <Field label={en.common.from}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={en.common.to}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label={en.common.type}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {typeOptions.map((t) => <option key={t} value={t}>{t === "All" ? "All" : t}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <RunningRows partyId={id} from={from} to={to} type={type} />
    </Page>
  );
}
