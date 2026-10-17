import { useState } from "react";
import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { CashDelta, DuesLine, MetalDelta } from "../../components/ui/Dues.tsx";
import { EmptyState, SectionLabel } from "../../components/ui/Bits.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { RoleTags } from "../../components/ui/TypeTag.tsx";
import { TypeTag } from "../../components/ui/TypeTag.tsx";
import { SearchInput } from "../../components/ui/Field.tsx";
import { InstallCard } from "./InstallCard.tsx";
import { StockHomeCard } from "../stock/Stock.tsx";
import { MarketHero } from "../summary/MarketHero.tsx";
import { listActivity } from "../../data/index.ts";
import { useAllBalancesLive, usePartyList } from "../../hooks/useLive.ts";
import { dayLabel } from "../../lib/format.ts";

export function HomePage() {
  const balances = useAllBalancesLive();
  const parties = usePartyList();
  const recent = useLiveQuery(() => listActivity({ limit: 6 }), []);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  // Metal dues lead the list: owners settle metal in metal, so parties owed
  // anything in gold/silver rank before cash-only parties. Within each group,
  // receivable metal first (biggest Get-gold), then silver, then cash size.
  const hasMetalDue = (b: { goldFineMg: number; silverFineMg: number }) => b.goldFineMg !== 0 || b.silverFineMg !== 0;
  const partyRows = (parties ?? [])
    .map((p) => ({ p, b: balances?.[p.id] ?? { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 } }))
    .filter(({ p }) => !query || p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query))
    .sort((a, b) => {
      const am = hasMetalDue(a.b);
      const bm = hasMetalDue(b.b);
      if (am !== bm) return am ? -1 : 1;
      if (am) {
        if (a.b.goldFineMg !== b.b.goldFineMg) return b.b.goldFineMg - a.b.goldFineMg;
        if (a.b.silverFineMg !== b.b.silverFineMg) return b.b.silverFineMg - a.b.silverFineMg;
      }
      return Math.abs(b.b.cashPaise) - Math.abs(a.b.cashPaise);
    });

  return (
    <Page
      title="Jewelr"
      subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
      action={<Link to="/vouchers/new"><Button>+ New</Button></Link>}
      contentClass="stagger"
    >
      <MarketHero />

      <InstallCard />

      <StockHomeCard />

      <SectionLabel note={parties === undefined ? undefined : query ? `${partyRows.length} of ${parties.length}` : parties.length}>
        Parties
      </SectionLabel>

      <SearchInput placeholder="Search party…" value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />

      {parties !== undefined && partyRows.length === 0 && (
        <EmptyState
          title={query ? "No party matches" : "No parties yet"}
          hint={query ? "Try a different name or mobile number." : "Add your first party, then record sales and payments against their khata."}
          action={!query ? <Link to="/parties/new"><Button>Add party</Button></Link> : undefined}
        />
      )}

      {partyRows.map(({ p, b }) => (
        <Link key={p.id} to={`/parties/${p.id}`} className="tappable block">
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
        <>
          <SectionLabel note={(recent ?? []).length}>Latest activity</SectionLabel>
          <Card>
            {(recent ?? []).map((a) => (
              <Link key={a.voucherId} to={`/vouchers/${a.voucherId}`} className="row-press flex items-center gap-2.5 rounded-lg border-b border-stone-100 py-2 last:border-0 active:bg-stone-50">
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
        </>
      )}
    </Page>
  );
}
