import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link } from "react-router";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { Chip } from "../../components/ui/Bits.tsx";
import { Field, Input } from "../../components/ui/Field.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { CashDelta, DuesLine, MetalDelta } from "../../components/ui/Dues.tsx";
import { TypeTag, RoleTags } from "../../components/ui/TypeTag.tsx";
import { getEntriesInRange, listActivity } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";
import { dayLabel, formatGram, formatINR, todayLocal } from "../../lib/format.ts";
import { useAllBalancesLive, usePartyList } from "../../hooks/useLive.ts";

type Preset = "Today" | "7 days" | "Month" | "Custom";

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

  const netCash = rows.reduce((n, [, b]) => n + b.cashPaise, 0);
  const netGold = rows.reduce((n, [, b]) => n + b.goldFineMg, 0);
  const netSilver = rows.reduce((n, [, b]) => n + b.silverFineMg, 0);

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
    <Page title={en.nav.summary}>
      <div className="rounded-3xl bg-stone-900 p-5 text-white shadow-md">
        <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">Business position</div>
        <BalanceGrid cashPaise={netCash} goldFineMg={netGold} silverFineMg={netSilver} dark />
      </div>

      {toReceive.length > 0 && (
        <Card>
          <div className="mb-1 text-sm font-semibold text-emerald-800">Top to receive</div>
          <p className="mb-2 text-xs text-stone-500">Ranked metal first — grams owed before cash.</p>
          {toReceive.map(([partyId, b]) => (
            <Link key={partyId} to={`/parties/${partyId}`} className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0">
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
            <Link key={partyId} to={`/parties/${partyId}`} className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0">
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
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(["Today", "7 days", "Month", "Custom"] as const).map((p) => (
            <Chip key={p} selected={preset === p} onClick={() => setPreset(p)}>{p}</Chip>
          ))}
        </div>
        {preset === "Custom" && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Field label={en.common.from}><Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></Field>
            <Field label={en.common.to}><Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></Field>
          </div>
        )}
        <div className="mb-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
          {period.count === 0 ? (
            "No entries in this period."
          ) : (
            <>
              {period.count} entries · {formatINR(period.cash)}
              {period.gold !== 0 && <> · G {formatGram(period.gold)}</>}
              {period.silver !== 0 && <> · S {formatGram(period.silver)}</>}
            </>
          )}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {["All", "SALE", "PURCHASE", "RECEIPT", "PAYMENT", "CONVERSION"].map((t) => (
            <Chip key={t} selected={typeFilter === t} onClick={() => setTypeFilter(t)}>{t === "All" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}</Chip>
          ))}
        </div>
        <div className="flex flex-col">
          {(feed ?? []).map((a) => (
            <Link key={a.voucherId} to={`/vouchers/${a.voucherId}`} className="flex items-center gap-2.5 border-b border-stone-100 py-2 last:border-0">
              <PartyAvatar name={nameOf(a.partyId)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <TypeTag type={a.type} />
                  <span className="truncate text-sm font-medium text-stone-900">{nameOf(a.partyId)}</span>
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
          {(feed ?? []).length === 0 && <p className="text-sm text-stone-500">Nothing here for this filter.</p>}
        </div>
      </Card>
    </Page>
  );
}
