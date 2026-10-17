import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link } from "react-router";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Chip } from "../../components/ui/Bits.tsx";
import { Field, Input } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { CashDelta, DuesLine, MetalDelta } from "../../components/ui/Dues.tsx";
import { TypeTag, RoleTags } from "../../components/ui/TypeTag.tsx";
import { getEntriesInRange, listActivity } from "../../data/index.ts";
import { cn } from "../../lib/cn.ts";
import { en } from "../../i18n/en.ts";
import { dayLabel, todayLocal } from "../../lib/format.ts";
import { useAllBalancesLive, usePartyList } from "../../hooks/useLive.ts";
import { MarketHero } from "./MarketHero.tsx";

type Preset = "Today" | "7 days" | "Month" | "Custom";

/** Activity type pills — compact, tinted with the entry palette when picked. */
const TYPE_FILTERS = [
  { type: "All", label: "All", on: "bg-stone-800 border-stone-800 text-white" },
  { type: "SALE", label: "Sale", on: "bg-amber-100 border-amber-300 text-amber-900" },
  { type: "PURCHASE", label: "Purchase", on: "bg-sky-100 border-sky-300 text-sky-900" },
  { type: "RECEIPT", label: "Receive", on: "bg-emerald-100 border-emerald-300 text-emerald-900" },
  { type: "PAYMENT", label: "Pay Out", on: "bg-orange-100 border-orange-300 text-orange-900" },
  { type: "CONVERSION", label: "Convert", on: "bg-violet-100 border-violet-300 text-violet-900" },
] as const;

function shiftDays(base: string, delta: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + delta);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function rangeFor(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const today = todayLocal();
  if (preset === "Today") return { from: today, to: today };
  if (preset === "7 days") return { from: shiftDays(today, -6), to: today };
  if (preset === "Month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: customFrom || today, to: customTo || today };
}

export function SummaryPage() {
  const [preset, setPreset] = useState<Preset>("7 days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(todayLocal());
  const [typeFilter, setTypeFilter] = useState<string>("All");
  const { from, to } = rangeFor(preset, customFrom, customTo);

  const balances = useAllBalancesLive();
  const parties = usePartyList();
  const entries = useLiveQuery(() => getEntriesInRange(from, to), [from, to]);
  const feed = useLiveQuery(
    () => listActivity({ from, to, types: typeFilter === "All" ? undefined : [typeFilter], limit: 30 }),
    [from, to, typeFilter],
  );

  const partyOf = (id: string) => (parties ?? []).find((p) => p.id === id);
  const nameOf = (id: string) => partyOf(id)?.name ?? "…";

  const rows = Object.entries(balances ?? {});
  // Any-column dues count (a party owing only metal is invisible to a
  // cash-only filter). Ranked metal-first — metal settles in metal, so grams
  // owed decide who gets acted on; cash breaks ties.
  const toReceive = rows
    .filter(([, b]) => b.cashPaise > 0 || b.goldFineMg > 0 || b.silverFineMg > 0)
    .sort((a, b) =>
      b[1].goldFineMg - a[1].goldFineMg
      || b[1].silverFineMg - a[1].silverFineMg
      || b[1].cashPaise - a[1].cashPaise,
    )
    .slice(0, 3);
  const toPay = rows
    .filter(([, b]) => b.cashPaise < 0 || b.goldFineMg < 0 || b.silverFineMg < 0)
    .sort((a, b) =>
      a[1].goldFineMg - b[1].goldFineMg
      || a[1].silverFineMg - b[1].silverFineMg
      || a[1].cashPaise - b[1].cashPaise,
    )
    .slice(0, 3);

  const period = (entries ?? []).reduce(
    (t, e) => ({
      cash: t.cash + e.cashDeltaPaise,
      gold: t.gold + e.goldFineDeltaMg,
      silver: t.silver + e.silverFineDeltaMg,
      count: t.count + 1,
    }),
    { cash: 0, gold: 0, silver: 0, count: 0 },
  );

  return (
    <Page title={en.nav.summary} contentClass="stagger">
      <MarketHero />

      {toReceive.length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-semibold text-emerald-800">Top to receive</div>
          <p className="mb-2 text-xs text-stone-500">Ranked metal first — grams owed before cash.</p>
          {toReceive.map(([partyId, b]) => (
            <Link key={partyId} to={`/parties/${partyId}`} className="row-press flex items-center gap-3 rounded-lg border-b border-stone-100 py-2 last:border-0 active:bg-stone-50">
              <PartyAvatar name={nameOf(partyId)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-stone-900">{nameOf(partyId)}</div>
                <div className="mt-0.5">
                  <RoleTags isCustomer={partyOf(partyId)?.isCustomer ?? false} isSupplier={partyOf(partyId)?.isSupplier ?? false} />
                </div>
              </div>
              <DuesLine cashPaise={b.cashPaise} goldFineMg={b.goldFineMg} silverFineMg={b.silverFineMg} />
            </Link>
          ))}
        </Card>
      )}
      {toPay.length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-semibold text-red-800">Top to pay</div>
          {toPay.map(([partyId, b]) => (
            <Link key={partyId} to={`/parties/${partyId}`} className="row-press flex items-center gap-3 rounded-lg border-b border-stone-100 py-2 last:border-0 active:bg-stone-50">
              <PartyAvatar name={nameOf(partyId)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-stone-900">{nameOf(partyId)}</div>
                <div className="mt-0.5">
                  <RoleTags isCustomer={partyOf(partyId)?.isCustomer ?? false} isSupplier={partyOf(partyId)?.isSupplier ?? false} />
                </div>
              </div>
              <DuesLine cashPaise={b.cashPaise} goldFineMg={b.goldFineMg} silverFineMg={b.silverFineMg} />
            </Link>
          ))}
        </Card>
      )}

      <Card>
        <div className="mb-2 text-sm font-semibold text-stone-900">Activity</div>

        <Segmented
          options={["Today", "7 days", "Month", "Custom"] as const}
          value={preset}
          onChange={(p) => setPreset(p)}
        />
        {preset === "Custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Field label={en.common.from}><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
            <Field label={en.common.to}><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
          </div>
        )}

        {/* Period total: count left, signed move right — same delta language as rows below. */}
        <div className="anim-fade mt-2 mb-2 flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            {period.count === 0 ? "No entries in this period" : `${period.count} ${period.count === 1 ? "entry" : "entries"}`}
          </span>
          {period.count > 0 && (
            <span className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0.5 text-xs">
              <CashDelta paise={period.cash} />
              <MetalDelta mg={period.gold} metal="GOLD" />
              <MetalDelta mg={period.silver} metal="SILVER" />
            </span>
          )}
        </div>

        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          {TYPE_FILTERS.map((t) => (
            <Chip
              key={t.type}
              selected={typeFilter === t.type}
              onClick={() => setTypeFilter(t.type)}
              className={cn("min-h-7 px-2.5 text-xs", typeFilter === t.type && t.on)}
            >
              {t.label}
            </Chip>
          ))}
        </div>

        {(feed ?? []).length === 0 && <p className="anim-fade text-sm text-stone-500">Nothing here for this filter.</p>}

        {/* Day-grouped feed — when over row labels, one header per day. */}
        {(feed ?? []).length > 0 && (
          <div className="mt-1 flex flex-col">
            {(feed ?? []).reduce<Array<{ date: string; items: NonNullable<typeof feed> }>>((acc, a) => {
              const last = acc[acc.length - 1];
              if (last && last.date === a.businessDate) last.items.push(a);
              else acc.push({ date: a.businessDate, items: [a] });
              return acc;
            }, []).map((g) => (
              <div key={g.date} className="flex flex-col">
                <div className="mb-0.5 mt-2 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{dayLabel(g.date)}</span>
                  <span className="h-px flex-1 bg-stone-100" />
                </div>
                {g.items.map((a) => (
                  <Link key={a.voucherId} to={`/vouchers/${a.voucherId}`} className="row-press flex items-center gap-2.5 rounded-lg border-b border-stone-100 py-2 last:border-0 active:bg-stone-50">
                    <PartyAvatar name={nameOf(a.partyId)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="truncate text-sm font-medium text-stone-900">{nameOf(a.partyId)}</span>
                        <TypeTag type={a.type} className="shrink-0" />
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-xs">
                        <CashDelta paise={a.cashDeltaPaise} />
                        <MetalDelta mg={a.goldFineDeltaMg} metal="GOLD" />
                        <MetalDelta mg={a.silverFineDeltaMg} metal="SILVER" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </Card>
    </Page>
  );
}
