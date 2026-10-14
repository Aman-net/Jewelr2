import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { DuesLine } from "../../components/ui/Dues.tsx";
import { EmptyState } from "../../components/ui/Bits.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { useAllBalancesLive, usePartyList, useRecentVouchersLive } from "../../hooks/useLive.ts";
import { dayLabel, formatINR } from "../../lib/format.ts";

export function HomePage() {
  const balances = useAllBalancesLive();
  const parties = usePartyList();
  const recent = useRecentVouchersLive(6);
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
      title="Hisaab"
      action={<Link to="/vouchers/new"><Button>+ New</Button></Link>}
    >
      <div className="rounded-2xl bg-stone-900 p-4 text-white shadow-sm">
        <div className="text-xs font-medium uppercase tracking-wide text-stone-400">
          {netCash >= 0 ? "Market owes you" : "You owe market"}
        </div>
        <div className="text-3xl font-bold">{formatINR(Math.abs(netCash))}</div>
        {(netGold !== 0 || netSilver !== 0) && (
          <div className="mt-1 text-xs text-stone-300">
            {netGold !== 0 && <>Gold {(netGold / 1000).toFixed(3)} g fine · </>}
            {netSilver !== 0 && <>Silver {(netSilver / 1000).toFixed(3)} g fine</>}
          </div>
        )}
        <Link to="/summary" className="mt-2 inline-block text-xs font-medium text-amber-300">
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
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-stone-900">{p.name}</div>
                <div className="text-xs text-stone-500">
                  {[p.isCustomer ? "Customer" : "", p.isSupplier ? "Supplier" : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
              <DuesLine cashPaise={b.cashPaise} goldFineMg={b.goldFineMg} silverFineMg={b.silverFineMg} />
            </div>
          </Card>
        </Link>
      ))}

      {(recent ?? []).length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-medium text-stone-700">Latest activity</div>
          {(recent ?? []).map((v) => (
            <Link key={v.id} to={`/vouchers/${v.id}`} className="flex items-baseline justify-between gap-2 border-b border-stone-100 py-1.5 text-sm last:border-0">
              <span className="truncate text-stone-900">{v.type}</span>
              <span className="shrink-0 text-xs text-stone-500">{dayLabel(v.businessDate)}</span>
            </Link>
          ))}
        </Card>
      )}
    </Page>
  );
}
