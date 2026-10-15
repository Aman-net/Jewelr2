import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BalanceDelta, Voucher } from "../../domain/index.ts";
import { formatRate, formatTunch } from "../../lib/format.ts";
import type { StatementRow } from "../../data/index.ts";

/**
 * A4 khata statement PDF, generated on-device (offline-safe).
 * Follows the owner-approved sample: shop header, account/period, opening
 * strip, day groups with balance-after strips, legend, closing box, footer.
 *
 * Font note: built-in Helvetica is WinAnsi-only, so this document writes
 * "Rs" instead of ₹ and avoids arrows (→). A ₹-capable embedded font can
 * replace the helpers below later without touching layout.
 */

/** Dummy header until the shop/account store lands (owner-confirmed). */
export const SHOP_DUMMY = {
  name: "[YOUR SHOP NAME]",
  address: "[Shop address, city]",
  phone: "[Phone]",
  gstin: "GSTIN [if any]",
};

/** Deterministic statement number so reprints match: KS-YYYYMMDD-NNN. */
export function statementNo(partyId: string, from: string, to: string): string {
  let h = 0;
  for (const ch of `${partyId}|${from}|${to}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `KS-${to.replaceAll("-", "")}-${String((h % 900) + 100)}`;
}

const in2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const in0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Paise → "Rs 1,250.00". */
export function rs2(paise: number): string {
  return `Rs ${in2.format(paise / 100)}`;
}

/** Milligrams → "20.000 g" (exact, never trimmed — paper needs the zeros). */
export function g3(mg: number): string {
  return `${(mg / 1000).toFixed(3)} g`;
}

/** Signed table cell: "+1,250.00" / "-200.00" / "—". */
export function signed2(paise: number): string {
  if (paise === 0) return "—";
  return `${paise > 0 ? "+" : "-"}${in2.format(Math.abs(paise) / 100)}`;
}

/** Signed grams cell: "+20.000" / "-50.000" / "—". */
export function signedG3(mg: number): string {
  if (mg === 0) return "—";
  return `${mg > 0 ? "+" : "-"}${(Math.abs(mg) / 1000).toFixed(3)}`;
}

/** Stored rate without the ₹ sign: "Rs 2,20,000/kg". */
export function ratePdf(paise: number, unit: "GOLD_PER_10G" | "SILVER_PER_KG"): string {
  return formatRate(paise, unit).replace("₹", "Rs ").replace(" per ", "/");
}

/** "Rs 2,20,000" (no paise) for compact rate mentions. */
export function rs0(paise: number): string {
  return `Rs ${in0.format(paise / 100)}`;
}

const TYPE_WORDS: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  RECEIPT: "Payment received",
  PAYMENT: "Payment made",
  CONVERSION: "Rate fix",
  OPENING: "Opening",
  ADJUSTMENT: "Adjustment",
  REVERSAL: "Reversal",
};

export interface DocRow {
  serial: number;
  head: string;
  details: string[];
  cash: number;
  gold: number;
  silver: number;
}

export interface DocDay {
  date: string;
  rows: DocRow[];
  balCash: number;
  balGold: number;
  balSilver: number;
}

/** Row head: "Sale · Silver Chain · #1". */
export function rowHead(type: string, v: Voucher | undefined, serial: number): string {
  const base = TYPE_WORDS[type] ?? type;
  if (!v) return `${base} · #${serial}`;
  if ((v.type === "SALE" || v.type === "PURCHASE") && v.lines.length > 0) {
    const first = v.lines[0]!;
    const metal = first.metalType === "GOLD" ? "Gold" : "Silver";
    const more = v.lines.length > 1 ? ` +${v.lines.length - 1} more` : "";
    const ref = v.referenceNumber ? ` · Bill ${v.referenceNumber}` : "";
    return `${base} · ${metal} ${first.categoryName}${more} · #${serial}${ref}`;
  }
  const ref = v.referenceNumber ? ` · Bill ${v.referenceNumber}` : "";
  const mode = v.settlement?.paymentMode ? ` · ${v.settlement.paymentMode}` : "";
  return `${base}${mode} · #${serial}${ref}`;
}

/** Plain-word breakup lines for one voucher (strings only — PDF-safe). */
export function buildDocDetails(v: Voucher): string[] {
  const out: string[] = [];
  for (const l of v.lines) {
    const wt = `${(l.physicalMg / 1000).toFixed(3)} g gross x ${formatTunch(l.agreedTunchScaled)} tunch = ${g3(l.fineMg)} fine`;
    const rate = l.pricingMode === "CASH_AT_RATE" && l.rateAmountPaise !== undefined && l.rateUnit
      ? ` · @ ${ratePdf(l.rateAmountPaise, l.rateUnit)} = ${rs2(l.lineCashPaise)}`
      : " · rate: open";
    out.push(`${wt}${rate}`);
    if (l.labourPaise > 0) {
      const basis = l.labourMode === "PER_PIECE"
        ? `${l.itemCount ?? "?"} x ${rs2(l.labourRatePaise ?? 0)}/pc`
        : `${(l.physicalMg / 1000).toFixed(0)} g x ${rs0(l.labourRatePaise ?? 0)}/kg`;
      out.push(`Labour ${basis} = ${rs2(l.labourPaise)}`);
    }
  }
  for (const m of v.misc) out.push(`${m.label} (extra) ${rs2(m.cashPaise)}`);
  const s = v.settlement;
  if (s) {
    if (s.goldFineMg > 0) out.push(`Gold ${s.goldPhysicalMg ? `${(s.goldPhysicalMg / 1000).toFixed(3)} g x ${formatTunch(s.goldTunchScaled ?? 0)} = ` : ""}${g3(s.goldFineMg)} fine`);
    if (s.silverFineMg > 0) out.push(`Silver ${s.silverPhysicalMg ? `${(s.silverPhysicalMg / 1000).toFixed(3)} g x ${formatTunch(s.silverTunchScaled ?? 0)} = ` : ""}${g3(s.silverFineMg)} fine`);
  }
  const c = v.conversion;
  if (c) {
    const qty = c.direction === "METAL_TO_CASH"
      ? `${g3(c.fineMg)} ${c.metalType.toLowerCase()} -> ${rs2(c.cashPaise)}`
      : `${rs2(c.cashPaise)} -> ${g3(c.fineMg)} ${c.metalType.toLowerCase()}`;
    out.push(`${qty} @ ${ratePdf(c.rateAmountPaise, c.rateUnit)}`);
    out.push(c.side === "PARTY_OWES" ? "Settled from party due" : "Settled from our due");
  }
  if (v.notes) out.push(`Note: ${v.notes}`);
  return out;
}

function dueWords(cash: number, gold: number, silver: number): string {
  const parts: string[] = [];
  if (cash !== 0) parts.push(`${cash > 0 ? "You owe us" : "We owe you"} ${rs2(Math.abs(cash))}`);
  if (gold !== 0) parts.push(`${gold > 0 ? "You owe us" : "We owe you"} ${g3(Math.abs(gold))} gold`);
  if (silver !== 0) parts.push(`${silver > 0 ? "You owe us" : "We owe you"} ${g3(Math.abs(silver))} silver`);
  return parts.length > 0 ? parts.join(" · ") : "all settled";
}

const ACCENT = "#7c2d12";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 9, color: "#1c1917", backgroundColor: "#ffffff" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  shop: { fontSize: 20, fontWeight: "bold", color: ACCENT },
  shopSub: { marginTop: 4, fontSize: 9, color: "#57534e" },
  docTitle: { fontSize: 10, fontWeight: "bold", letterSpacing: 2, color: "#57534e", textAlign: "right" },
  docNo: { marginTop: 2, fontSize: 11, fontWeight: "bold", textAlign: "right" },
  docGen: { marginTop: 2, fontSize: 9, color: "#57534e", textAlign: "right" },
  rule: { marginTop: 10, marginBottom: 10, borderBottomWidth: 1.5, borderBottomColor: "#1c1917" },
  acctRow: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8, fontWeight: "bold", letterSpacing: 1.5, color: "#57534e" },
  acctName: { marginTop: 3, fontSize: 14, fontWeight: "bold" },
  acctSub: { marginTop: 1, fontSize: 9, color: "#57534e" },
  period: { marginTop: 3, fontSize: 12, fontWeight: "bold", textAlign: "right" },
  periodSub: { marginTop: 1, fontSize: 9, color: "#57534e", textAlign: "right" },
  opening: { marginTop: 10, backgroundColor: "#f5f0e8", borderRadius: 6, padding: 8, flexDirection: "row", justifyContent: "space-between" },
  openingTitle: { fontWeight: "bold" },
  openingVals: { color: "#57534e" },
  head: { marginTop: 12, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1c1917", paddingBottom: 4 },
  headCell: { fontSize: 8, fontWeight: "bold", letterSpacing: 1.5, color: "#57534e" },
  dayBar: { marginTop: 8, backgroundColor: "#1c1917", color: "#ffffff", paddingVertical: 4, paddingHorizontal: 8, fontWeight: "bold", fontSize: 9 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4" },
  particulars: { flex: 1, paddingRight: 8 },
  rowHead: { fontWeight: "bold", fontSize: 9.5 },
  detail: { marginTop: 1, fontSize: 8.5, color: "#57534e" },
  amt: { width: 90, textAlign: "right", fontWeight: "bold", fontSize: 9.5 },
  balStrip: { backgroundColor: "#f5f0e8", paddingVertical: 4, paddingHorizontal: 8, flexDirection: "row", justifyContent: "space-between" },
  balTitle: { fontWeight: "bold" },
  balVals: { color: "#57534e" },
  legend: { marginTop: 10, fontSize: 8.5, color: "#57534e" },
  closingBox: { marginTop: 12, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 8, padding: 12 },
  closingTitle: { fontSize: 9, fontWeight: "bold", letterSpacing: 1.5, color: ACCENT },
  closingRow: { marginTop: 8, flexDirection: "row" },
  closingCell: { flex: 1 },
  closingLabel: { fontSize: 9, color: "#57534e" },
  closingVal: { marginTop: 2, fontSize: 15, fontWeight: "bold" },
  closingWords: { marginTop: 1, fontSize: 9, color: "#57534e" },
  footer: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  footerNote: { flex: 1, fontSize: 8.5, color: "#57534e", paddingRight: 16 },
  sign: { fontSize: 9, color: "#57534e", textAlign: "right" },
});

export interface StatementDocProps {
  partyName: string;
  partyMobile?: string;
  from: string;
  to: string;
  fromLabel: string;
  toLabel: string;
  generatedAt: string;
  no: string;
  opening: BalanceDelta;
  openingLabel: string;
  days: DocDay[];
  entryCount: number;
  totals: BalanceDelta;
  closing: BalanceDelta;
  closingLabel: string;
  hasGold: boolean;
}

function CloseCell({ label, value, words }: { label: string; value: string; words: string }) {
  return (
    <View style={s.closingCell}>
      <Text style={s.closingLabel}>{label}</Text>
      <Text style={s.closingVal}>{value}</Text>
      <Text style={s.closingWords}>{words}</Text>
    </View>
  );
}

export function StatementDoc(p: StatementDocProps) {
  const cashWords = p.closing.cashPaise === 0 ? "Settled" : p.closing.cashPaise > 0 ? "You owe us" : "We owe you";
  const goldWords = p.closing.goldFineMg === 0 ? "Settled" : p.closing.goldFineMg > 0 ? "You owe us" : "We owe you";
  const silverWords = p.closing.silverFineMg === 0 ? "Settled" : p.closing.silverFineMg > 0 ? "You owe us" : "We owe you";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.topRow}>
          <View>
            <Text style={s.shop}>{SHOP_DUMMY.name}</Text>
            <Text style={s.shopSub}>{SHOP_DUMMY.address} · {SHOP_DUMMY.phone} · {SHOP_DUMMY.gstin}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>KHATA STATEMENT</Text>
            <Text style={s.docNo}>No. {p.no}</Text>
            <Text style={s.docGen}>Generated {p.generatedAt}</Text>
          </View>
        </View>
        <View style={s.rule} />
        <View style={s.acctRow}>
          <View>
            <Text style={s.label}>ACCOUNT OF</Text>
            <Text style={s.acctName}>{p.partyName}</Text>
            {p.partyMobile ? <Text style={s.acctSub}>{p.partyMobile}</Text> : null}
          </View>
          <View>
            <Text style={[s.label, { textAlign: "right" }]}>PERIOD</Text>
            <Text style={s.period}>{p.fromLabel} - {p.toLabel}</Text>
            <Text style={s.periodSub}>{p.entryCount} entries</Text>
          </View>
        </View>
        <View style={s.opening}>
          <Text style={s.openingTitle}>{p.openingLabel}</Text>
          <Text style={s.openingVals}>
            Cash {rs2(p.opening.cashPaise)} · Silver {g3(p.opening.silverFineMg)} · Gold {g3(p.opening.goldFineMg)} · {dueWords(p.opening.cashPaise, p.opening.goldFineMg, p.opening.silverFineMg)}
          </Text>
        </View>
        <View style={s.head}>
          <Text style={[s.headCell, { flex: 1 }]}>PARTICULARS</Text>
          <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>CASH Rs</Text>
          <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>GOLD (g)</Text>
          <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>SILVER (g)</Text>
        </View>
        {p.days.length === 0 ? (
          <View style={s.row}><Text style={s.detail}>No entries in this period — opening and closing match.</Text></View>
        ) : null}
        {p.days.map((d) => (
          <View key={d.date} wrap={false}>
            <Text style={s.dayBar}>{d.date}</Text>
            {d.rows.map((r) => (
              <View key={r.serial} style={s.row}>
                <View style={s.particulars}>
                  <Text style={s.rowHead}>{r.head}</Text>
                  {r.details.map((ln, i) => <Text key={i} style={s.detail}>{ln}</Text>)}
                </View>
                <Text style={s.amt}>{signed2(r.cash)}</Text>
                <Text style={s.amt}>{signedG3(r.gold)}</Text>
                <Text style={s.amt}>{signedG3(r.silver)}</Text>
              </View>
            ))}
            <View style={s.balStrip}>
              <Text style={s.balTitle}>Balance after {d.date}</Text>
              <Text style={s.balVals}>{dueWords(d.balCash, d.balGold, d.balSilver)}</Text>
            </View>
          </View>
        ))}
        <Text style={s.legend}>
          + adds to what you owe us · - reduces what you owe us.
          {!p.hasGold ? " Gold: no entries this period." : ""} Silver is held as fine weight; rate is fixed later unless shown.
        </Text>
        <View style={s.closingBox} wrap={false}>
          <Text style={s.closingTitle}>{p.closingLabel}</Text>
          <View style={s.closingRow}>
            <CloseCell label="Cash" value={rs2(Math.abs(p.closing.cashPaise))} words={cashWords} />
            <CloseCell label="Silver (fine)" value={g3(Math.abs(p.closing.silverFineMg))} words={silverWords} />
            <CloseCell label="Gold (fine)" value={g3(Math.abs(p.closing.goldFineMg))} words={goldWords} />
          </View>
        </View>
        <View style={s.footer}>
          <Text style={s.footerNote}>Balance as per our books. Please report any difference within 7 days of receiving this statement.</Text>
          <Text style={s.sign}>For {SHOP_DUMMY.name}{"\n"}Authorised signature</Text>
        </View>
      </Page>
    </Document>
  );
}

export type { StatementRow };
