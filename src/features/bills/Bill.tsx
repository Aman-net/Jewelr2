import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Button } from "../../components/ui/Button.tsx";
import { Field, Input } from "../../components/ui/Field.tsx";
import { LoadingRow } from "../../components/ui/Loader.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { MetalTag } from "../../components/ui/TypeTag.tsx";
import { assembleVoucher, db, getParty, getStatement } from "../../data/index.ts";
import { firstOfMonth } from "../../data/statement.ts";
import type { StatementRow } from "../../data/index.ts";
import type { Voucher } from "../../domain/index.ts";
import { formatDate, formatGram, formatINR, formatRate, formatTunch, todayLocal } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";
import type { DocDay } from "./StatementPdf.tsx";

/** App types → paper words. Ledger descriptions stay in data, never shown raw. */
const TYPE_WORDS: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  RECEIPT: "Got",
  PAYMENT: "Gave",
  CONVERSION: "Rate fix",
  OPENING: "Opening",
  ADJUSTMENT: "Adjustment",
  REVERSAL: "Reversal",
};

/** Type badge + card accent, same palette as khata tags so entries read by color. */
const TYPE_BADGE: Record<string, string> = {
  SALE: "bg-amber-100 text-amber-900",
  PURCHASE: "bg-sky-100 text-sky-900",
  RECEIPT: "bg-emerald-100 text-emerald-900",
  PAYMENT: "bg-orange-100 text-orange-900",
  CONVERSION: "bg-violet-100 text-violet-900",
  REVERSAL: "bg-red-100 text-red-900",
};
const TYPE_ACCENT: Record<string, string> = {
  SALE: "border-l-amber-500",
  PURCHASE: "border-l-sky-500",
  RECEIPT: "border-l-emerald-500",
  PAYMENT: "border-l-orange-500",
  CONVERSION: "border-l-violet-500",
  REVERSAL: "border-l-red-400",
};

/** One amount: — when untouched, else signed value. Meaning taught once in the legend. */
function Amt({ value, text, getTone }: { value: number; text: string; getTone: string }) {
  if (value === 0) return <span className="text-stone-300">—</span>;
  const add = value > 0;
  return (
    <span className={cn("font-bold", add ? getTone : "text-red-700")}>
      {add ? "+" : "−"}{text}
    </span>
  );
}

/** Cash / Gold / Silver move strip. Absent metals drop out statement-wide. */
function MoveStrip({ cash, gold, silver, showGold = true, showSilver = true }: {
  cash: number;
  gold: number;
  silver: number;
  showGold?: boolean;
  showSilver?: boolean;
}) {
  const cells: { label: string; bg: string; node: React.ReactNode }[] = [
    { label: "Cash", bg: "bg-emerald-50", node: <Amt value={cash} text={formatINR(Math.abs(cash))} getTone="text-emerald-700" /> },
    ...(showGold
      ? [{ label: "Gold", bg: "bg-amber-50", node: <Amt value={gold} text={formatGram(Math.abs(gold))} getTone="text-amber-700" /> }]
      : []),
    ...(showSilver
      ? [{ label: "Silver", bg: "bg-slate-100", node: <Amt value={silver} text={formatGram(Math.abs(silver))} getTone="text-slate-600" /> }]
      : []),
  ];
  return (
    <div className={cn("grid gap-2", cells.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {cells.map((c) => (
        <div key={c.label} className={cn("rounded-xl px-2 py-1.5 text-center", c.bg)}>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{c.label}</div>
          <div className="text-sm">{c.node}</div>
        </div>
      ))}
    </div>
  );
}

/** Per-entry breakup in plain words. Only applicable lines render. */
function EntryDetails({ v }: { v: Voucher }) {
  // Line amounts follow the voucher: sales add to due, purchases reduce it.
  const lineSign = v.type === "PURCHASE" ? "−" : "+";
  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-dashed border-stone-200 pt-2 text-[13px]">
      {v.lines.map((l, i) => (
        <div key={l.id}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-stone-800">
              <span className="shrink-0 font-medium tabular-nums text-stone-400">#{i + 1}</span>
              <MetalTag metal={l.metalType} />
              <span className="truncate font-semibold">{l.categoryName}</span>
              {l.itemCount ? <span className="shrink-0 text-stone-500">{l.itemCount} pcs</span> : null}
            </span>
            {l.pricingMode === "CASH_AT_RATE" ? (
              <span className="shrink-0 font-bold tabular-nums text-stone-900">{lineSign}{formatINR(l.lineCashPaise)}</span>
            ) : (
              <span className="shrink-0 font-bold tabular-nums text-amber-700">{formatGram(l.fineMg)}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs tabular-nums text-stone-500">
            {formatGram(l.physicalMg)} × {formatTunch(l.agreedTunchScaled)} → {formatGram(l.fineMg)} fine
            {l.pricingMode === "CASH_AT_RATE" && l.rateAmountPaise !== undefined && l.rateUnit ? (
              <> · @{formatRate(l.rateAmountPaise, l.rateUnit).replace(" per ", "/")}</>
            ) : (
              " · rate later"
            )}
            {l.labourPaise > 0 ? (
              <>
                {" "}· labour {formatINR(l.labourPaise)}
                {l.labourMode === "PER_PIECE" ? ` (${l.itemCount ?? "?"}×${formatINR(l.labourRatePaise ?? 0)})` : ""}
                {l.labourMode === "PER_KG" ? ` (${formatGram(l.physicalMg)}×${formatINR(l.labourRatePaise ?? 0)}/kg)` : ""}
              </>
            ) : null}
          </div>
        </div>
      ))}
      {v.misc.map((m) => (
        <div key={m.label} className="flex justify-between gap-2">
          <span>{m.label} (extra)</span>
          <b className="text-stone-800">{formatINR(m.cashPaise)}</b>
        </div>
      ))}
      {v.settlement ? (
        <div>
          {[
            (v.settlement.cashPaise ?? 0) > 0 ? `Cash ${formatINR(v.settlement.cashPaise ?? 0)}` : "",
            v.settlement.goldFineMg > 0
              ? `Gold ${v.settlement.goldPhysicalMg ? `${formatGram(v.settlement.goldPhysicalMg)} × ${formatTunch(v.settlement.goldTunchScaled ?? 0)} → ` : ""}${formatGram(v.settlement.goldFineMg)} fine`
              : "",
            v.settlement.silverFineMg > 0
              ? `Silver ${v.settlement.silverPhysicalMg ? `${formatGram(v.settlement.silverPhysicalMg)} × ${formatTunch(v.settlement.silverTunchScaled ?? 0)} → ` : ""}${formatGram(v.settlement.silverFineMg)} fine`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          {v.settlement.paymentMode ? ` · via ${v.settlement.paymentMode}` : null}
        </div>
      ) : null}
      {v.conversion ? (
        <div>
          {v.conversion.direction === "METAL_TO_CASH" ? (
            <>
              {formatGram(v.conversion.fineMg)} {v.conversion.metalType.toLowerCase()} →{" "}
              <b>{formatINR(v.conversion.cashPaise)}</b>
            </>
          ) : (
            <>
              {formatINR(v.conversion.cashPaise)} → <b>{formatGram(v.conversion.fineMg)} {v.conversion.metalType.toLowerCase()}</b>
            </>
          )}
          <div>
            Rate {formatRate(v.conversion.rateAmountPaise, v.conversion.rateUnit)} ·{" "}
            {v.conversion.side === "PARTY_OWES" ? "from party due" : "from our due"}
          </div>
        </div>
      ) : null}
      {v.notes ? <div className="italic text-stone-500">{v.notes}</div> : null}
    </div>
  );
}

/** Opening / period / closing box: title plus the same metal strip. */
function DuesBox({ title, cash, gold, silver, metals, amber, children }: {
  title: string;
  cash: number;
  gold: number;
  silver: number;
  metals: { gold: boolean; silver: boolean };
  amber?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card className={amber ? "border-amber-200 bg-amber-50/60" : undefined}>
      <div className={amber
        ? "mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-800"
        : "mb-2 text-[11px] font-semibold uppercase tracking-widest text-stone-500"}>
        {title}
      </div>
      <MoveStrip cash={cash} gold={gold} silver={silver} showGold={metals.gold} showSilver={metals.silver} />
      {children}
    </Card>
  );
}

/** Gross in/out volumes under the net period move. */
function GrossLine({ grossIn, grossOut, metals }: {
  grossIn: { cashPaise: number; goldFineMg: number; silverFineMg: number };
  grossOut: { cashPaise: number; goldFineMg: number; silverFineMg: number };
  metals: { gold: boolean; silver: boolean };
}) {
  const parts = [
    `cash in ${formatINR(grossIn.cashPaise)} · out ${formatINR(Math.abs(grossOut.cashPaise))}`,
    metals.gold ? `gold in ${formatGram(grossIn.goldFineMg)} · out ${formatGram(Math.abs(grossOut.goldFineMg))}` : "",
    metals.silver ? `silver in ${formatGram(grossIn.silverFineMg)} · out ${formatGram(Math.abs(grossOut.silverFineMg))}` : "",
  ].filter(Boolean);
  return <div className="mt-2 text-[11px] text-stone-500">{parts.join(" · ")}</div>;
}

function EntryBlock({ row, voucher, metals }: {
  row: StatementRow;
  voucher?: Voucher;
  metals: { gold: boolean; silver: boolean };
}) {
  const netZero = row.pair !== undefined && row.cashDeltaPaise === 0 && row.goldFineDeltaMg === 0 && row.silverFineDeltaMg === 0;
  return (
    <div className={cn("rounded-2xl border border-stone-200 border-l-4 bg-white px-3 py-2.5 shadow-sm", TYPE_ACCENT[row.type] ?? "border-l-stone-300")}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium tabular-nums text-stone-400">
          #{row.serial}{row.pair ? `, #${row.pair.otherSerial}` : ""}
        </span>
        <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-bold", TYPE_BADGE[row.type] ?? "bg-stone-100 text-stone-600")}>
          {TYPE_WORDS[row.type] ?? row.type}
        </span>
        {row.referenceNumber ? <span className="text-xs text-stone-500">Bill {row.referenceNumber}</span> : null}
        <Link to={`/vouchers/${row.voucherId}`} className="bill-row ml-auto shrink-0 text-xs font-medium text-amber-800">Open ›</Link>
      </div>
      {row.pair ? (
        <div className="mt-1 text-xs italic text-stone-500">
          and its reversal{netZero ? " · no net effect" : ""}{row.pair.reason ? ` — ${row.pair.reason}` : ""}
        </div>
      ) : null}
      <div className="mt-2">
        <MoveStrip
          cash={row.cashDeltaPaise}
          gold={row.goldFineDeltaMg}
          silver={row.silverFineDeltaMg}
          showGold={metals.gold}
          showSilver={metals.silver}
        />
      </div>
      {voucher ? <EntryDetails v={voucher} /> : null}
    </div>
  );
}

/**
 * Date-range bill: opening + full-detail entries + period move + closing.
 * Derived and live — reversals rewrite it exactly like the khata.
 * Print via the OS dialog (print CSS hides nav and controls).
 */
export function BillPage() {
  const { id = "" } = useParams();
  const [from, setFrom] = useState(() => firstOfMonth(todayLocal()));
  const [to, setTo] = useState(() => todayLocal());
  const [applied, setApplied] = useState(() => ({ from: firstOfMonth(todayLocal()), to: todayLocal() }));
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const party = useLiveQuery(() => getParty(id), [id]);
  const data = useLiveQuery(async () => {
    const st = await getStatement(id, applied.from, applied.to).catch(() => undefined);
    if (!st) return undefined;
    const vouchers = new Map<string, Voucher>();
    await Promise.all(
      st.rows.map(async (r) => {
        const v = await assembleVoucher(db, r.voucherId);
        if (v) vouchers.set(r.voucherId, v);
      }),
    );
    return { st, vouchers };
  }, [id, applied]);
  // Frozen at generation: a print viewed months later must not read as "today".
  const generatedAt = useMemo(
    () => new Date().toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applied.from, applied.to],
  );
  const groups = useMemo(() => {
    const rows = data?.st.rows ?? [];
    const byDay = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byDay.get(r.businessDate) ?? [];
      list.push(r);
      byDay.set(r.businessDate, list);
    }
    // Running serials live on the rows (pairs consume two numbers).
    return [...byDay.entries()].map(([date, list]) => ({ date, rows: list }));
  }, [data]);

  if (party === undefined) return <Page title=""><LoadingRow label="Loading bill…" /></Page>;
  if (!party) return <Page title="Bill"><Card><p className="text-sm text-stone-500">Party not found.</p></Card></Page>;

  const apply = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setApplied({ from: f, to: t });
  };
  const statement = data?.st;

  /** A4 PDF via on-device renderer (lazy — never in the startup bundle). */
  const downloadPdf = async () => {
    if (!statement || !party) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const [{ pdf }, doc] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./StatementPdf.tsx"),
      ]);
      const days: DocDay[] = groups.map(({ date, rows }) => {
        const docRows = rows.map((r) => {
          const v = data?.vouchers.get(r.voucherId);
          return {
            sno: r.pair ? `#${r.serial}, #${r.pair.otherSerial}` : `#${r.serial}`,
            head: doc.rowHead(r.type, v),
            details: [
              ...(r.pair ? [doc.pairNote(r.cashDeltaPaise, r.goldFineDeltaMg, r.silverFineDeltaMg, r.pair.reason)] : []),
              ...(v ? doc.buildDocDetails(v) : []),
            ],
            cash: r.cashDeltaPaise,
            gold: r.goldFineDeltaMg,
            silver: r.silverFineDeltaMg,
            balCash: r.balCashPaise,
            balGold: r.balGoldFineMg,
            balSilver: r.balSilverFineMg,
          };
        });
        const last = rows[rows.length - 1]!;
        return { date: formatDate(date), rows: docRows, balCash: last.balCashPaise, balGold: last.balGoldFineMg, balSilver: last.balSilverFineMg };
      });
      const to = applied.to || todayLocal();
      const blob = await pdf(
        <doc.StatementDoc
          partyName={party.name}
          partyMobile={party.mobile}
          from={applied.from}
          to={to}
          fromLabel={applied.from ? formatDate(applied.from) : "Beginning"}
          toLabel={formatDate(to)}
          generatedAt={generatedAt}
          no={doc.statementNo(id, applied.from, to)}
          opening={statement.opening}
          openingLabel={applied.from ? `Opening balance, before ${formatDate(applied.from)}` : "Opening balance, start"}
          days={days}
          entryCount={statement.rows.length}
          totals={statement.totals}
          grossIn={statement.grossIn}
          grossOut={statement.grossOut}
          closing={statement.closing}
          closingLabel={`CLOSING BALANCE AS ON ${formatDate(to).toUpperCase()}`}
          metals={statement.metals}
        />,
      ).toBlob();
      const filename = `Jewelr-${party.name.replace(/[^\w]+/g, "-")}-${applied.from || "Beginning"}-${to}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : "Could not make PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Page title={`Bill · ${party.name}`} backTo={`/parties/${id}`} backLabel="Khata">
      <div className="bill-controls flex flex-col gap-3">
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><Input type="date" value={from} max={to || todayLocal()} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To"><Input type="date" value={to} max={todayLocal()} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => apply(firstOfMonth(todayLocal()), todayLocal())}>
              This month
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => apply("", to || todayLocal())}>
              Full khata
            </Button>
            <Button className="flex-1" onClick={() => setApplied({ from, to })}>Show</Button>
          </div>
        </Card>
      </div>

      {statement === undefined ? (
        <LoadingRow label="Building bill…" />
      ) : (
        <div className="bill-sheet flex flex-col gap-3">
          <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">Khata statement</div>
            <div className="mt-2 flex items-center gap-3">
              <PartyAvatar name={party.name} size="lg" />
              <div className="min-w-0">
                <div className="truncate text-2xl font-bold tracking-tight text-stone-900">{party.name}</div>
                {party.mobile ? <div className="text-sm text-stone-500">{party.mobile}</div> : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
                {applied.from ? formatDate(applied.from) : "Beginning"} → {applied.to ? formatDate(applied.to) : formatDate(todayLocal())}
              </span>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                {statement.rows.length} entries
              </span>
            </div>
            <div className="mt-2 text-xs text-stone-400">Generated {generatedAt}</div>
          </div>

          <DuesBox
            title={applied.from ? `Opening balance · before ${formatDate(applied.from)}` : "Opening balance · start"}
            cash={statement.opening.cashPaise}
            gold={statement.opening.goldFineMg}
            silver={statement.opening.silverFineMg}
            metals={statement.metals}
          />

          <div className="px-1 text-[11px] text-stone-500">
            <b className="text-emerald-700">+</b> adds to due · <b className="text-red-700">−</b> reduces due · <b>—</b> untouched
          </div>

          {statement.rows.length === 0 && (
            <Card><p className="text-sm text-stone-500">No entries in this period — opening and closing match.</p></Card>
          )}
          {groups.map(({ date, rows }) => (
            <div key={date} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-stone-800 px-3 py-1 text-[11px] font-bold text-white">{formatDate(date)}</span>
                <span className="h-px flex-1 bg-stone-200" />
                <span className="text-[11px] font-medium tabular-nums text-stone-400">{rows.length}</span>
              </div>
              {rows.map((r) => (
                <EntryBlock key={r.voucherId} row={r} voucher={data?.vouchers.get(r.voucherId)} metals={statement.metals} />
              ))}
            </div>
          ))}

          <DuesBox
            title="Period move · net"
            cash={statement.totals.cashPaise}
            gold={statement.totals.goldFineMg}
            silver={statement.totals.silverFineMg}
            metals={statement.metals}
          >
            <GrossLine grossIn={statement.grossIn} grossOut={statement.grossOut} metals={statement.metals} />
          </DuesBox>

          <DuesBox
            title="Closing due — collect or pay"
            cash={statement.closing.cashPaise}
            gold={statement.closing.goldFineMg}
            silver={statement.closing.silverFineMg}
            metals={statement.metals}
            amber
          />

          <div className="bill-controls flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="flex-1"><Button variant="secondary" full onClick={() => window.print()}>Print</Button></div>
              <div className="flex-1"><Button full onClick={() => void downloadPdf()} disabled={pdfBusy}>{pdfBusy ? "Making PDF…" : "PDF bill"}</Button></div>
            </div>
            {pdfError ? <p className="text-sm font-medium text-red-700">{pdfError}</p> : null}
          </div>
        </div>
      )}
    </Page>
  );
}
