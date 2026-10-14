import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { Sheet } from "../../components/ui/Bits.tsx";
import { DuesHead } from "../../components/ui/Dues.tsx";
import { CheckRow, Field, Input, Select, Textarea } from "../../components/ui/Field.tsx";
import { getBalances, getBalancesAsOf, getLedger, getParty, updateParty } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";
import { dayLabel, formatGram, formatINR, todayLocal } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";

const entryActions = [
  { to: "sale", label: "Sell", hint: "Gave goods" },
  { to: "receipt", label: "Got", hint: "Received" },
  { to: "purchase", label: "Buy", hint: "Took goods" },
  { to: "payment", label: "Gave", hint: "Paid out" },
  { to: "conversion", label: "Rate", hint: "Fix rate" },
  { to: "opening", label: "Opening", hint: "Old balance" },
] as const;

const typeOptions = ["All", "SALE", "PURCHASE", "RECEIPT", "PAYMENT", "CONVERSION", "OPENING", "ADJUSTMENT", "REVERSAL"] as const;

export function KhataPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const duplicateName = (location.state as { duplicateName?: boolean } | null)?.duplicateName;
  const party = useLiveQuery(() => getParty(id), [id]);
  const balances = useLiveQuery(() => getBalances(id), [id]);
  const [editing, setEditing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [asOfOpen, setAsOfOpen] = useState(false);
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

  if (party === undefined) return <Page title=""><Card><p className="text-sm text-stone-500">Loading khata…</p></Card></Page>;
  if (!party) return <Page title="Khata"><Card><p className="text-sm text-stone-500">Party not found.</p></Card></Page>;

  const cash = balances?.cashPaise ?? 0;
  const inward = cash >= 0;

  return (
    <Page
      title={party.name}
      action={<button className="text-sm font-medium text-amber-800" onClick={() => setEditing((e) => !e)}>{editing ? en.common.cancel : "Edit"}</button>}
    >
      {duplicateName ? (
        <div className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{en.party.duplicateWarn}</div>
      ) : null}

      <div className={cn("rounded-2xl border p-4 shadow-sm", inward ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
        <DuesHead cashPaise={cash} goldFineMg={balances?.goldFineMg ?? 0} silverFineMg={balances?.silverFineMg ?? 0} />
        {party.mobile ? <div className="mt-1 text-sm text-stone-600">{party.mobile}</div> : null}
      </div>

      {editing ? (
        <EditParty
          partyId={party.id}
          initial={{ mobile: party.mobile ?? "", address: party.address ?? "", notes: party.notes ?? "", active: party.active }}
          onDone={() => setEditing(false)}
        />
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        {entryActions.map((a) => (
          <Link key={a.to} to={`/vouchers/new/${a.to}?party=${party.id}`}>
            <div className="rounded-2xl border border-stone-200 bg-white px-2 py-2.5 text-center shadow-sm active:bg-amber-50">
              <div className="text-sm font-semibold text-stone-900">{a.label}</div>
              <div className="text-[11px] text-stone-500">{a.hint}</div>
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
      {groups.map((g) => (
        <div key={g.date}>
          <div className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{dayLabel(g.date)}</div>
          <div className="flex flex-col gap-2">
            {g.rows.map(({ e, balCash }) => (
              <Link key={e.voucherId} to={`/vouchers/${e.voucherId}`}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-stone-900">{e.description}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500">
                        <span className={cn("rounded px-1.5 py-0.5 font-semibold", typeChip[shortType(e.description)] ?? "bg-stone-100")}>{shortType(e.description)}</span>
                        {e.cashDeltaPaise !== 0 && <span className={e.cashDeltaPaise > 0 ? "text-emerald-700" : "text-red-700"}>{formatINR(e.cashDeltaPaise)}</span>}
                        {e.goldFineDeltaMg !== 0 && <span>G {formatGram(e.goldFineDeltaMg)}</span>}
                        {e.silverFineDeltaMg !== 0 && <span>S {formatGram(e.silverFineDeltaMg)}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-stone-500">
                      <div>Bal</div>
                      <div className="font-semibold text-stone-700">{formatINR(balCash)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

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
              <div className="flex-1"><Button variant="secondary" full onClick={() => { setFrom(""); setTo(""); setType("All"); }}>Clear</Button></div>
              <div className="flex-1"><Button full onClick={() => setFilterOpen(false)}>Show</Button></div>
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

const typeChip: Record<string, string> = {
  SALE: "bg-amber-100 text-amber-900",
  PURCHASE: "bg-sky-100 text-sky-900",
  RECEIPT: "bg-emerald-100 text-emerald-900",
  PAYMENT: "bg-orange-100 text-orange-900",
  CONVERSION: "bg-violet-100 text-violet-900",
  OPENING: "bg-stone-200 text-stone-700",
  ADJUSTMENT: "bg-stone-200 text-stone-700",
  REVERSAL: "bg-red-100 text-red-900",
};

function EditParty({ partyId, initial, onDone }: {
  partyId: string;
  initial: { mobile: string; address: string; notes: string; active: boolean };
  onDone: () => void;
}) {
  const [mobile, setMobile] = useState(initial.mobile);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <Field label={en.party.mobile}><Input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" /></Field>
        <Field label={en.party.address}><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></Field>
        <Field label={en.party.notes}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        <CheckRow label={en.party.active}>
          <input type="checkbox" className="h-6 w-6 accent-amber-700" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </CheckRow>
        {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await updateParty(partyId, {
                mobile: mobile.trim() || undefined,
                address: address.trim() || undefined,
                notes: notes.trim() || undefined,
                active,
              });
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save");
            } finally {
              setSaving(false);
            }
          }}
        >
          {en.common.save}
        </Button>
      </div>
    </Card>
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
