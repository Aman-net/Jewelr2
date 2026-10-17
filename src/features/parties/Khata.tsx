import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, History, Percent, ReceiptText, Scale, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { LoadingRow } from "../../components/ui/Loader.tsx";
import { Sheet } from "../../components/ui/Bits.tsx";
import { TypeTag, RoleTags } from "../../components/ui/TypeTag.tsx";
import { Field, Input, Select } from "../../components/ui/Field.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { getBalances, getBalancesAsOf, getLedger, getParty, hasLiveOpening, listGeneratedBills, listVouchers } from "../../data/index.ts";
import { db } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";
import { dayLabel, formatDate, formatGram, formatINR, formatTime, todayLocal } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";

interface EntryAction {
  to: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
  tint: string;
  needs: "customer" | "supplier" | null;
  href?: string;
}

const entryActions: EntryAction[] = [
  { to: "sale", label: "Sale", hint: "Goods out", Icon: TrendingUp, tint: "bg-amber-100 text-amber-800", needs: "customer" },
  { to: "receipt", label: "Receive", hint: "Money in", Icon: ArrowDownToLine, tint: "bg-emerald-100 text-emerald-800", needs: null },
  { to: "purchase", label: "Purchase", hint: "Goods in", Icon: TrendingDown, tint: "bg-sky-100 text-sky-800", needs: "supplier" },
  { to: "payment", label: "Pay Out", hint: "Money out", Icon: ArrowUpFromLine, tint: "bg-orange-100 text-orange-800", needs: null },
  { to: "conversion", label: "Convert", hint: "Fix rate", Icon: Percent, tint: "bg-violet-100 text-violet-800", needs: null },
  { to: "bill", label: "Statement", hint: "Ledger report", Icon: ReceiptText, tint: "bg-teal-100 text-teal-800", needs: null, href: "BILL" },
];

function actionAllowed(party: { isCustomer: boolean; isSupplier: boolean }, needs: "customer" | "supplier" | null): boolean {
  if (needs === "customer") return party.isCustomer;
  if (needs === "supplier") return party.isSupplier;
  return true;
}

const typeOptions = ["All", "SALE", "PURCHASE", "RECEIPT", "PAYMENT", "CONVERSION", "OPENING", "ADJUSTMENT", "REVERSAL"] as const;

export function KhataPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const duplicateName = (location.state as { duplicateName?: boolean } | null)?.duplicateName;
  const party = useLiveQuery(() => getParty(id), [id]);
  const balances = useLiveQuery(() => getBalances(id), [id]);
  const needsOpening = useLiveQuery(async () => !(await hasLiveOpening(db, id)), [id]);
  const bills = useLiveQuery(() => listGeneratedBills(id), [id]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [billsOpen, setBillsOpen] = useState(false);
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
  const voucherMap = useLiveQuery(async () => {
    const rows = await listVouchers({ partyId: id });
    return new Map(rows.map((v) => [v.id, v]));
  }, [id]);
  // A from-date truncates the past, so the running "Bal" must start from the
  // TRUE balance before that day — not zero. (from = "" → full history, no seed.)
  const seedBalances = useLiveQuery(
    () => (from ? getBalancesAsOf(id, dayBefore(from)) : undefined),
    [id, from],
  );
  const seed = from ? seedBalances : undefined;

  const groups = useMemo(() => {
    const running = {
      cash: seed?.cashPaise ?? 0,
      gold: seed?.goldFineMg ?? 0,
      silver: seed?.silverFineMg ?? 0,
    };
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
  }, [entries, seed]);

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  let shown = 0;
  const visibleGroups = groups.flatMap((g) => {
    if (shown >= visibleCount) return [];
    const take = g.rows.slice(0, visibleCount - shown);
    shown += take.length;
    return take.length > 0 ? [{ ...g, rows: take }] : [];
  });

  if (party === undefined) return <Page title=""><LoadingRow label="Loading khata…" /></Page>;
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
        {entryActions.map((a) => {
          const allowed = actionAllowed(party, a.needs);
          const tile = (
            <div className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border border-stone-200 bg-white px-2 py-3 shadow-sm",
              allowed ? "active:bg-amber-50" : "opacity-45",
            )}>
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", a.tint)}>
                <a.Icon size={18} />
              </span>
              <span className="text-sm font-semibold text-stone-900">{a.label}</span>
              <span className="-mt-1 text-[11px] text-stone-500">
                {allowed ? a.hint : a.needs === "customer" ? "customers only" : "suppliers only"}
              </span>
            </div>
          );
          return allowed ? (
            <Link key={a.to} to={a.href === "BILL" ? `/parties/${party.id}/bill` : `/vouchers/new/${a.to}?party=${party.id}`}>{tile}</Link>
          ) : (
            <div key={a.to} aria-disabled="true">{tile}</div>
          );
        })}
      </div>

      {needsOpening ? (
        <Link to={`/vouchers/new/opening?party=${party.id}`} className="self-center text-xs font-medium text-stone-500">
          No opening balance yet — set it
        </Link>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-700">Entries</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setAsOfOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-800 shadow-sm active:bg-amber-50"
        >
          <History size={16} /> Past balance
        </button>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="relative flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-800 shadow-sm active:bg-amber-50"
        >
          <SlidersHorizontal size={16} /> Filter
          {(from || to || type !== "All") ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-amber-600" /> : null}
        </button>
        <button
          type="button"
          onClick={() => setBillsOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-white py-2.5 text-sm font-semibold text-stone-800 shadow-sm active:bg-amber-50"
        >
          <ReceiptText size={16} /> Bills{(bills !== undefined && bills.length > 0) ? ` · ${bills.length}` : ""}
        </button>
      </div>

      {entries === undefined && <LoadingRow />}
      {entries === undefined ? null : from ? (
        seed ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] tabular-nums text-stone-600">
            Balance before {dayLabel(from)}: {balParts(seed.cashPaise, seed.goldFineMg, seed.silverFineMg) || formatINR(0)}
          </div>
        ) : null
      ) : type !== "All" ? (
        <p className="text-[11px] text-stone-500">
          Filtered view — the “Bal” line counts these entries from zero, not the account balance. Use Past balance for true snapshots.
        </p>
      ) : null}
      {entries !== undefined && groups.length === 0 && (
        <Card><p className="text-sm text-stone-500">No entries yet. Tap Sell or Got above to record the first one.</p></Card>
      )}
      {visibleGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          {visibleGroups.flatMap((g) => g.rows).map(({ e, balCash, balGold, balSilver }) => {
            const type = shortType(e.description);
            const voucher = voucherMap?.get(e.voucherId);
            return (
              <Link key={e.voucherId} to={`/vouchers/${e.voucherId}`}>
                <Card>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      <TypeTag type={type} label={PLAIN_TYPE[type] ?? e.description} className="shrink-0" />
                      {voucher?.referenceNumber ? (
                        <span className="min-w-0 truncate text-sm font-semibold text-stone-900">Bill {voucher.referenceNumber}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-stone-400">
                      {formatDate(e.businessDate)} · {formatTime(e.createdAt)}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <DeltaCell label="Cash" value={e.cashDeltaPaise} text={formatINR(Math.abs(e.cashDeltaPaise))} tone={e.cashDeltaPaise > 0 ? "text-emerald-700" : "text-red-700"} />
                    <DeltaCell label="Gold" value={e.goldFineDeltaMg} text={formatGram(Math.abs(e.goldFineDeltaMg))} tone="text-amber-700" />
                    <DeltaCell label="Silver" value={e.silverFineDeltaMg} text={formatGram(Math.abs(e.silverFineDeltaMg))} tone="text-slate-600" />
                  </div>
                  <BalanceRow cash={balCash} gold={balGold} silver={balSilver} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {totalRows > visibleCount && (
        <Button variant="secondary" full onClick={() => setVisibleCount((c) => c + 50)}>
          Show older entries ({totalRows - visibleCount} more)
        </Button>
      )}

      {asOfOpen && <AsOfSheet partyId={id} onClose={() => setAsOfOpen(false)} />}

      {billsOpen && (
        <Sheet title="Bills generated" onClose={() => setBillsOpen(false)}>
          <div className="flex flex-col gap-2">
            {(bills ?? []).length === 0 && (
              <p className="text-sm text-stone-500">
                None yet — open the <Link to={`/parties/${id}/bill`} className="font-medium text-amber-800">Bill</Link> tile to make one.
              </p>
            )}
            {(bills ?? []).map((b) => (
              <div key={b.id} className="flex items-center gap-2.5 rounded-2xl border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
                <ReceiptText size={18} className="shrink-0 text-teal-700" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-stone-900">
                    {(b.fromDate ? formatDate(b.fromDate) : "Beginning")} → {formatDate(b.toDate)}
                  </div>
                  <div className="text-[11px] text-stone-500">
                    {b.statementNo} · {new Date(b.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {b.channel === "PDF" ? "PDF" : "Print"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

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

/** Day before a YYYY-MM-DD date. */
function dayBefore(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Signed parts for a balance strip: "+₹500 · +G 10 g · −S 2 g". */
function balParts(cash: number, gold: number, silver: number): string {
  const signed = (v: number, t: string) => (v === 0 ? null : `${v > 0 ? "+" : "−"}${t}`);
  return [
    signed(cash, formatINR(Math.abs(cash))),
    gold !== 0 ? `${gold > 0 ? "+" : "−"}G ${formatGram(Math.abs(gold))}` : null,
    silver !== 0 ? `${silver > 0 ? "+" : "−"}S ${formatGram(Math.abs(silver))}` : null,
  ].filter((x): x is string => x !== null).join(" · ");
}

function shortType(description: string): string {
  return description.split(" ")[0] ?? description;
}

/** Professional type words for the entry tag. */
const PLAIN_TYPE: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  RECEIPT: "Receipt",
  PAYMENT: "Payment",
  CONVERSION: "Conversion",
  OPENING: "Opening",
  ADJUSTMENT: "Adjustment",
  REVERSAL: "Reversal",
};

/** One move cell: label above, signed value below, all three metals visually even. */
function DeltaCell({ label, value, text, tone }: {
  label: string;
  value: number;
  text: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-stone-50 px-1.5 py-1 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums", value === 0 ? "text-stone-300" : tone)}>
        {value === 0 ? "—" : <>{value > 0 ? "+" : "−"}{text}</>}
      </div>
    </div>
  );
}

/** Running balance strip: scale icon + label on the left, signed totals right. */
function BalanceRow({ cash, gold, silver }: { cash: number; gold: number; silver: number }) {
  const parts = [
    `${cash < 0 ? "−" : cash > 0 ? "+" : ""}${formatINR(Math.abs(cash))}`,
    gold !== 0 ? `${gold > 0 ? "+" : "−"}G ${formatGram(Math.abs(gold))}` : null,
    silver !== 0 ? `${silver > 0 ? "+" : "−"}S ${formatGram(Math.abs(silver))}` : null,
  ].filter((x): x is string => x !== null);
  return (
    <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-stone-200 pt-1.5">
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-stone-500">
        <Scale size={12} /> Balance
      </span>
      <span className="min-w-0 truncate text-[11px] font-semibold tabular-nums text-stone-600">{parts.join(" · ")}</span>
    </div>
  );
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
