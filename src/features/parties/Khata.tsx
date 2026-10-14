import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, Percent, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { Sheet } from "../../components/ui/Bits.tsx";
import { TypeTag, RoleTags } from "../../components/ui/TypeTag.tsx";
import { Field, Input, Select } from "../../components/ui/Field.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { getBalances, getBalancesAsOf, getLedger, getParty } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";
import { dayLabel, formatGram, formatINR, formatTime, todayLocal } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";

const entryActions = [
  { to: "sale", label: "Sell", hint: "Gave goods", Icon: TrendingUp, tint: "bg-amber-100 text-amber-800" },
  { to: "receipt", label: "Got", hint: "Received", Icon: ArrowDownToLine, tint: "bg-emerald-100 text-emerald-800" },
  { to: "purchase", label: "Buy", hint: "Took goods", Icon: TrendingDown, tint: "bg-sky-100 text-sky-800" },
  { to: "payment", label: "Gave", hint: "Paid out", Icon: ArrowUpFromLine, tint: "bg-orange-100 text-orange-800" },
  { to: "conversion", label: "Rate", hint: "Fix rate", Icon: Percent, tint: "bg-violet-100 text-violet-800" },
  { to: "opening", label: "Opening", hint: "Old balance", Icon: BookOpen, tint: "bg-stone-200 text-stone-700" },
] as const;

const typeOptions = ["All", "SALE", "PURCHASE", "RECEIPT", "PAYMENT", "CONVERSION", "OPENING", "ADJUSTMENT", "REVERSAL"] as const;

export function KhataPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const duplicateName = (location.state as { duplicateName?: boolean } | null)?.duplicateName;
  const party = useLiveQuery(() => getParty(id), [id]);
  const balances = useLiveQuery(() => getBalances(id), [id]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [asOfOpen, setAsOfOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<string>("All");

  const entries = useLiveQuery(
    () => getLedger(id, {
      from: from || undefined,
      to: to || undefined,
      types: type === "All" ? undefined : [type],
    }),
    [id, from, to, type],
  );

  const groups = useMemo(() => {
    const running = { cash: 0, gold: 0, silver: 0 };
    const chronological = (entries ?? []).map((e) => {
      const row = {
        e,
        balCash: running.cash + e.cashDeltaPaise,
        balGold: running.gold + e.goldFineDeltaMg,
        balSilver: running.silver + e.silverFineDeltaMg,
      };
      running.cash = row.balCash;
      running.gold = row.balGold;
      running.silver = row.balSilver;
      return row;
    });
    const byDay = new Map<string, typeof chronological>();
    for (const row of chronological) {
      const list = byDay.get(row.e.businessDate) ?? [];
      list.push(row);
      byDay.set(row.e.businessDate, list);
    }
    return [...byDay.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, rows]) => ({ date, rows: rows.reverse() }));
  }, [entries]);

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  let shown = 0;
  const visibleGroups = groups.flatMap((g) => {
    if (shown >= visibleCount) return [];
    const take = g.rows.slice(0, visibleCount - shown);
    shown += take.length;
    return take.length > 0 ? [{ ...g, rows: take }] : [];
  });

  if (party === undefined) return <Page title=""><Card><p className="text-sm text-stone-500">Loading khata…</p></Card></Page>;
  if (!party) return <Page title="Khata"><Card><p className="text-sm text-stone-500">Party not found.</p></Card></Page>;

  const cash = balances?.cashPaise ?? 0;
  const gold = balances?.goldFineMg ?? 0;
  const silver = balances?.silverFineMg ?? 0;
  const lastDate = entries !== undefined && entries.length > 0 ? entries[entries.length - 1]?.businessDate : undefined;

  return (
    <Page
      title={party.name}
      action={<Link to={`/parties/${party.id}/edit`} className="text-sm font-medium text-amber-800">Edit</Link>}
    >
      {duplicateName ? (
        <div className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{en.party.duplicateWarn}</div>
      ) : null}

      <div className="rounded-3xl bg-stone-900 p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <PartyAvatar name={party.name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <RoleTags isCustomer={party.isCustomer} isSupplier={party.isSupplier} />
              {party.mobile ? <span className="text-xs text-stone-300">{party.mobile}</span> : null}
            </div>
            <div className="mt-0.5 text-xs text-stone-400">
              {lastDate ? `Last entry ${dayLabel(lastDate)}` : "No entries yet"}
              {!party.active ? " · inactive" : ""}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <BalanceGrid cashPaise={cash} goldFineMg={gold} silverFineMg={silver} dark />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {entryActions.map((a) => (
          <Link key={a.to} to={`/vouchers/new/${a.to}?party=${party.id}`}>
            <div className="flex flex-col items-center gap-1 rounded-2xl border border-stone-200 bg-white px-2 py-3 shadow-sm active:bg-amber-50">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", a.tint)}>
                <a.Icon size={18} />
              </span>
              <span className="text-sm font-semibold text-stone-900">{a.label}</span>
              <span className="-mt-1 text-[11px] text-stone-500">{a.hint}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-700">Entries</span>
        <div className="flex gap-3">
          <button className="text-sm font-medium text-amber-800" onClick={() => setAsOfOpen(true)}>Past balance</button>
          <button className="text-sm font-medium text-amber-800" onClick={() => setFilterOpen(true)}>
            Filter{(from || to || type !== "All") ? " • on" : ""}
          </button>
        </div>
      </div>

      {entries === undefined && <Card><p className="text-sm text-stone-500">Loading…</p></Card>}
      {entries !== undefined && groups.length === 0 && (
        <Card><p className="text-sm text-stone-500">No entries yet. Tap Sell or Got above to record the first one.</p></Card>
      )}
      {visibleGroups.map((g) => (
        <div key={g.date}>
          <div className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{dayLabel(g.date)}</div>
          <div className="flex flex-col gap-2">
            {g.rows.map(({ e, balCash, balGold, balSilver }) => (
              <Link key={e.voucherId} to={`/vouchers/${e.voucherId}`}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-stone-900">{e.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500">
                        <TypeTag type={shortType(e.description)} />
                        {e.cashDeltaPaise !== 0 && <span className={cn("font-semibold", e.cashDeltaPaise > 0 ? "text-emerald-700" : "text-red-700")}>{formatINR(e.cashDeltaPaise)}</span>}
                        {e.goldFineDeltaMg !== 0 && <span className="font-semibold text-amber-700">G {formatGram(e.goldFineDeltaMg)}</span>}
                        {e.silverFineDeltaMg !== 0 && <span className="font-semibold text-slate-600">S {formatGram(e.silverFineDeltaMg)}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-stone-500">
                      <div>Bal</div>
                      <div className="font-semibold text-stone-700">{formatINR(balCash)}</div>
                      {(balGold !== 0 || balSilver !== 0) && (
                        <div className="text-stone-500">
                          {balGold !== 0 ? `G ${formatGram(balGold)}` : ""}
                          {balGold !== 0 && balSilver !== 0 ? " · " : ""}
                          {balSilver !== 0 ? `S ${formatGram(balSilver)}` : ""}
                        </div>
                      )}
                      <div className="text-stone-400">{formatTime(e.createdAt)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {totalRows > visibleCount && (
        <Button variant="secondary" full onClick={() => setVisibleCount((c) => c + 50)}>
          Show older entries ({totalRows - visibleCount} more)
        </Button>
      )}

      {asOfOpen && <AsOfSheet partyId={id} onClose={() => setAsOfOpen(false)} />}

      {filterOpen && (
        <Sheet title="Filter entries" onClose={() => setFilterOpen(false)}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label={en.common.from}><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
              <Field label={en.common.to}><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
            </div>
            <Field label={en.common.type}>
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {typeOptions.map((t) => <option key={t} value={t}>{t === "All" ? "All" : t}</option>)}
              </Select>
            </Field>
            <div className="flex gap-2">
              <div className="flex-1"><Button variant="secondary" full onClick={() => { setFrom(""); setTo(""); setType("All"); setVisibleCount(50); }}>Clear</Button></div>
              <div className="flex-1"><Button full onClick={() => { setVisibleCount(50); setFilterOpen(false); }}>Show</Button></div>
            </div>
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function shortType(description: string): string {
  return description.split(" ")[0] ?? description;
}

export function AsOfSheet({ partyId, onClose }: { partyId: string; onClose: () => void }) {
  const [date, setDate] = useState(todayLocal());
  const bal = useLiveQuery(() => getBalancesAsOf(partyId, date), [partyId, date]);
  return (
    <Sheet title={`Balance on ${dayLabel(date)}`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="Date">
          <Input type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <BalanceGrid cashPaise={bal?.cashPaise ?? 0} goldFineMg={bal?.goldFineMg ?? 0} silverFineMg={bal?.silverFineMg ?? 0} />
        <Button full onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}
