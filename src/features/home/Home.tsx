import { useState } from "react";
import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { cn } from "../../lib/cn.ts";
import { CashDelta, DuesLine, MetalDelta } from "../../components/ui/Dues.tsx";
import { EmptyState } from "../../components/ui/Bits.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { RoleTags } from "../../components/ui/TypeTag.tsx";
import { TypeTag } from "../../components/ui/TypeTag.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { InstallCard } from "./InstallCard.tsx";
import { StockHomeCard } from "../stock/Stock.tsx";
import { listActivity } from "../../data/index.ts";
import { getAllDuesSplits } from "../../data/index.ts";
import { useAllBalancesLive, usePartyList } from "../../hooks/useLive.ts";
import { dayLabel } from "../../lib/format.ts";

export function HomePage() {
  const balances = useAllBalancesLive();
  const splits = useLiveQuery(() => getAllDuesSplits(), []);
  const parties = usePartyList();
  const recent = useLiveQuery(() => listActivity({ limit: 6 }), []);
  const [q, setQ] = useState("");
  const [duesView, setDuesView] = useState<"combined" | "sale" | "purchase">("combined");
  const query = q.trim().toLowerCase();
  const partyRows = (parties ?? [])
    .map((p) => ({ p, b: balances?.[p.id] ?? { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 } }))
    .filter(({ p }) => !query || p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query))
    .sort((a, b) => Math.abs(b.b.cashPaise) - Math.abs(a.b.cashPaise));

  // Market-wide buckets: what customers owe you (sale) vs what you owe
  // suppliers (purchase). Netting them hides both flows — hence the toggle.
  const market = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  const marketSale = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  const marketPurchase = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  for (const s of Object.values(splits ?? {})) {
    market.cashPaise += s.combined.cashPaise;
    market.goldFineMg += s.combined.goldFineMg;
    market.silverFineMg += s.combined.silverFineMg;
    marketSale.cashPaise += s.sale.cashPaise;
    marketSale.goldFineMg += s.sale.goldFineMg;
    marketSale.silverFineMg += s.sale.silverFineMg;
    marketPurchase.cashPaise += s.purchase.cashPaise;
    marketPurchase.goldFineMg += s.purchase.goldFineMg;
    marketPurchase.silverFineMg += s.purchase.silverFineMg;
  }
  const hero = duesView === "combined" ? market : duesView === "sale" ? marketSale : marketPurchase;

  return (
    <Page
      title="Jewelr"
      subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
      action={<Link to="/vouchers/new"><Button>+ New</Button></Link>}
    >
      <div className="rounded-3xl bg-stone-900 p-5 text-white shadow-md">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
          {hero.cashPaise >= 0 ? "Market owes you" : "You owe market"}
        </div>
        <BalanceGrid cashPaise={hero.cashPaise} goldFineMg={hero.goldFineMg} silverFineMg={hero.silverFineMg} dark />
        {duesView !== "combined" && (
          <div className="mt-2 text-[11px] text-stone-400">
            {duesView === "sale"
              ? "What customers owe you — sales minus received."
              : "What you owe suppliers — purchases minus paid."}
          </div>
        )}
        <div className="mt-3 flex gap-1.5">
          {(
            [
              ["combined", "Total"],
              ["sale", "Customers"],
              ["purchase", "Suppliers"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setDuesView(v)}
              className={cn(
                "flex-1 rounded-full px-2 py-1.5 text-xs font-bold",
                duesView === v ? "bg-amber-400 text-stone-900" : "bg-white/10 text-stone-300",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Link to="/summary" className="mt-3 inline-block text-xs font-medium text-amber-300">
          Full summary ›
        </Link>
      </div>

      <InstallCard />

      <StockHomeCard />

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
                  <CashDelta paise={a.cashDeltaPaise} />
                  <MetalDelta mg={a.goldFineDeltaMg} metal="GOLD" />
                  <MetalDelta mg={a.silverFineDeltaMg} metal="SILVER" />
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
