import { useState } from "react";
import { Link } from "react-router";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Select } from "../../components/ui/Field.tsx";
import { en } from "../../i18n/en.ts";
import { formatGram, formatINR, todayLocal } from "../../lib/format.ts";
import { useAllBalancesLive, usePartyList, useRecentVouchersLive } from "../../hooks/useLive.ts";

export function SummaryPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayLocal());
  const [type, setType] = useState("SALE_PURCHASE");
  const balances = useAllBalancesLive();
  const parties = usePartyList();
  const vouchers = useRecentVouchersLive(100, {
    types: type === "SALE_PURCHASE" ? ["SALE", "PURCHASE"] : undefined,
    from: from || undefined,
    to: to || undefined,
  });
  const nameOf = (id: string) => (parties ?? []).find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const rows = Object.entries(balances ?? {});

  return (
    <Page title={en.nav.summary}>
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-700">All-party balances</div>
        <div className="flex flex-col gap-1">
          {rows.map(([partyId, b]) => (
            <Link key={partyId} to={`/parties/${partyId}`} className="flex items-baseline justify-between gap-2 border-b border-stone-100 py-1.5 last:border-0">
              <span className="truncate text-sm font-medium text-stone-900">{nameOf(partyId)}</span>
              <span className="shrink-0 text-xs text-stone-600">
                {formatINR(b.cashPaise)} · G {formatGram(b.goldFineMg)} · S {formatGram(b.silverFineMg)}
              </span>
            </Link>
          ))}
          {rows.length === 0 && <p className="text-sm text-stone-500">No balances yet.</p>}
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-700">Sales / purchases</div>
        <div className="mb-2 grid grid-cols-3 gap-2">
          <Field label={en.common.from}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label={en.common.to}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <Field label={en.common.type}>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="SALE_PURCHASE">Sale+Buy</option>
              <option value="ALL">All types</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-col gap-1">
          {(vouchers ?? []).map((v) => (
            <Link key={v.id} to={`/vouchers/${v.id}`} className="flex items-baseline justify-between gap-2 border-b border-stone-100 py-1.5 last:border-0">
              <span className="truncate text-sm text-stone-900">{v.type} · {nameOf(v.partyId)}</span>
              <span className="shrink-0 text-xs text-stone-500">{v.businessDate}</span>
            </Link>
          ))}
          {(vouchers ?? []).length === 0 && <p className="text-sm text-stone-500">Nothing in this range.</p>}
        </div>
      </Card>
    </Page>
  );
}
