import { useState } from "react";
import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { DuesLine } from "../../components/ui/Dues.tsx";
import { EmptyState } from "../../components/ui/Bits.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { RoleTags } from "../../components/ui/TypeTag.tsx";
import { TypeTag } from "../../components/ui/TypeTag.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { listActivity } from "../../data/index.ts";
import { useAllBalancesLive, usePartyList } from "../../hooks/useLive.ts";
import { dayLabel, formatGram, formatINR } from "../../lib/format.ts";

export function HomePage() {
  const balances = useAllBalancesLive();
  const parties = usePartyList();
  const recent = useLiveQuery(() => listActivity({ limit: 6 }), []);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const partyRows = (parties ?? [])
    .map((p) => ({ p, b: balances?.[p.id] ?? { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 } }))
    .filter(({ p }) => !query || p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query))
    .sort((a, b) => Math.abs(b.b.cashPaise) - Math.abs(a.b.cashPaise));

  const netCash = Object.values(balances ?? {}).reduce((n, b) => n + b.cashPaise, 0);
  const netGold = Object.values(balances ?? {}).reduce((n, b) => n + b.goldFineMg, 0);
  const netSilver = Object.values(balances ?? {}).reduce((n, b) => n + b.silverFineMg, 0);

  return (
    <Page
      title="Jewelr"
      subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
      action={<Link to="/vouchers/new"><Button>+ New</Button></Link>}
    >
      <div className="rounded-3xl bg-stone-900 p-5 text-white shadow-md">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
          {netCash >= 0 ? "Market owes you" : "You owe market"}
        </div>
        <BalanceGrid cashPaise={netCash} goldFineMg={netGold} silverFineMg={netSilver} dark />
        <Link to="/summary" className="mt-3 inline-block text-xs font-medium text-amber-300">
          Full summary ›
        </Link>
      </div>

      <Input placeholder="Search party…" value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />

      {parties !== undefined && partyRows.length === 0 && (
        <EmptyState
          title={query ? "No party matches" : "No parties yet"}
          hint={query ? "Try a different name or mobile number." : "Add your first party, then record sales and payments against their khata."}
          action={!query ? <Link to="/parties/new"><Button>Add party</Button></Link> : undefined}
        />
      )}

      {partyRows.map(({ p, b }) => (
        <Link key={p.id} to={`/parties/${p.id}`}>
          <Card>
            <div className="flex items-center gap-3">
              <PartyAvatar name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{p.name}</div>
                <div className="mt-0.5"><RoleTags isCustomer={p.isCustomer} isSupplier={p.isSupplier} /></div>
              </div>
              <DuesLine cashPaise={b.cashPaise} goldFineMg={b.goldFineMg} silverFineMg={b.silverFineMg} />
            </div>
          </Card>
        </Link>
      ))}

      {(recent ?? []).length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-medium text-stone-700">Latest activity</div>
          {(recent ?? []).map((a) => (
            <Link key={a.voucherId} to={`/vouchers/${a.voucherId}`} className="flex items-center gap-2.5 border-b border-stone-100 py-2 last:border-0">
              <PartyAvatar name={(parties ?? []).find((p) => p.id === a.partyId)?.name ?? "…"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <TypeTag type={a.type} />
                  <span className="truncate text-sm font-medium text-stone-900">
                    {(parties ?? []).find((p) => p.id === a.partyId)?.name ?? "…"}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs">
                  {a.cashDeltaPaise !== 0 && (
                    <span className={a.cashDeltaPaise > 0 ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
                      {formatINR(a.cashDeltaPaise)}
                    </span>
                  )}
                  {a.goldFineDeltaMg !== 0 && <span className="font-semibold text-amber-700">G {formatGram(a.goldFineDeltaMg)}</span>}
                  {a.silverFineDeltaMg !== 0 && <span className="font-semibold text-slate-600">S {formatGram(a.silverFineDeltaMg)}</span>}
                </div>
              </div>
              <span className="shrink-0 text-[11px] text-stone-500">{dayLabel(a.businessDate)}</span>
            </Link>
          ))}
        </Card>
      )}
    </Page>
  );
}
