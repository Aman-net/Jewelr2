import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { BalanceDelta, Voucher } from "../../domain/index.ts";
import { formatRate, formatTunch } from "../../lib/format.ts";
import type { ShopDetails, StatementRow } from "../../data/index.ts";

/**
 * A4 khata statement PDF, generated on-device (offline-safe).
 * Follows the owner-approved sample: shop header, account/period, opening
 * strip, day groups with balance-after strips, legend, closing box, footer.
 *
 * Font note: built-in Helvetica is WinAnsi-only, so this document writes
 * "Rs" instead of ₹ and avoids arrows (→). A ₹-capable embedded font can
 * replace the helpers below later without touching layout.
 */

/** Brand + shop identity. Jewelr is the app signature; the shop block comes
 * from Settings → Shop (see `data/shop.ts`). */
export const APP_BRAND = "Jewelr";

/** Printed when the operator hasn't set a shop name yet. */
export const FALLBACK_SHOP_NAME = "My Shop";

/** Shop display name — never blank on paper. */
export function shopNameOf(shop: ShopDetails): string {
  return shop.name.trim() || FALLBACK_SHOP_NAME;
}

/** "address · phone · GSTIN", dropping whatever the operator left blank. */
export function shopSubLine(shop: ShopDetails): string {
  return [shop.address, shop.phone, shop.gstin]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(" · ");
}

/** Deterministic statement number lives in data (logging must not pull the renderer). */
export { statementNo } from "../../data/statement.ts";

const in2 = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const in0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** Paise → "Rs 1,250.00". */
export function rs2(paise: number): string {
  return `Rs ${in2.format(paise / 100)}`;
}

/** Milligrams → exact grams: gold keeps 3 decimals, silver whole grams (canonical). */
export function g3(mg: number, metal: "GOLD" | "SILVER"): string {
  return metal === "SILVER" ? `${Math.round(mg / 1000)} g` : `${(mg / 1000).toFixed(3)} g`;
}

/** Signed table cell: "+1,250.00" / "-200.00" / "—". */
export function signed2(paise: number): string {
  if (paise === 0) return "—";
  return `${paise > 0 ? "+" : "-"}${in2.format(Math.abs(paise) / 100)}`;
}

/** Signed grams cell: "+20.000" / "-50" / "—", metal precision. */
export function signedG3(mg: number, metal: "GOLD" | "SILVER"): string {
  if (mg === 0) return "—";
  const sign = mg > 0 ? "+" : "-";
  const abs = metal === "SILVER" ? `${Math.round(Math.abs(mg) / 1000)}` : `${(Math.abs(mg) / 1000).toFixed(3)}`;
  return `${sign}${abs}`;
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
  /** Paper serial at row start: "1", pairs "4, 5". */
  sno: string;
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

/** Row head: "Sale · Silver Chain". Serials live in their own column. */
export function rowHead(type: string, v: Voucher | undefined): string {
  const base = TYPE_WORDS[type] ?? type;
  if (!v) return base;
  if ((v.type === "SALE" || v.type === "PURCHASE") && v.lines.length > 0) {
    const first = v.lines[0]!;
    const metal = first.metalType === "GOLD" ? "Gold" : "Silver";
    const more = v.lines.length > 1 ? ` +${v.lines.length - 1} more` : "";
    const ref = v.referenceNumber ? ` · Bill ${v.referenceNumber}` : "";
    return `${base} · ${metal} ${first.categoryName}${more}${ref}`;
  }
  const ref = v.referenceNumber ? ` · Bill ${v.referenceNumber}` : "";
  const mode = v.settlement?.paymentMode ? ` · ${v.settlement.paymentMode}` : "";
  return `${base}${mode}${ref}`;
}

/** Pair note, first detail line on collapsed rows. */
export function pairNote(cash: number, gold: number, silver: number, reason?: string): string {
  const net = cash === 0 && gold === 0 && silver === 0 ? " · no net effect" : "";
  return `and its reversal${net}${reason ? ` — ${reason}` : ""}`;
}

/** Plain-word breakup lines for one voucher (strings only — PDF-safe). */
export function buildDocDetails(v: Voucher): string[] {
  const out: string[] = [];
  for (const l of v.lines) {
    const wt = `${g3(l.physicalMg, l.metalType)} gross x ${formatTunch(l.agreedTunchScaled)} tunch = ${g3(l.fineMg, l.metalType)} fine`;
    const rate = l.pricingMode === "CASH_AT_RATE" && l.rateAmountPaise !== undefined && l.rateUnit
      ? ` · @ ${ratePdf(l.rateAmountPaise, l.rateUnit)} = ${rs2(l.lineCashPaise)}`
      : " · rate: open";
    out.push(`${wt}${rate}`);
    if (l.labourPaise > 0) {
      const basis = l.labourMode === "PER_PIECE"
        ? `${l.itemCount ?? "?"} x ${rs2(l.labourRatePaise ?? 0)}/pc`
        : `${g3(l.physicalMg, l.metalType)} x ${rs0(l.labourRatePaise ?? 0)}/kg`;
      out.push(`Labour ${basis} = ${rs2(l.labourPaise)}`);
    }
  }
  for (const m of v.misc) out.push(`${m.label} ${m.cashPaise > 0 ? "(extra)" : "(discount)"} ${rs2(m.cashPaise)}`);
  const s = v.settlement;
  if (s) {
    if (s.goldFineMg > 0) out.push(`Gold ${s.goldPhysicalMg ? `${g3(s.goldPhysicalMg, "GOLD")} x ${formatTunch(s.goldTunchScaled ?? 0)} = ` : ""}${g3(s.goldFineMg, "GOLD")} fine`);
    if (s.silverFineMg > 0) out.push(`Silver ${s.silverPhysicalMg ? `${g3(s.silverPhysicalMg, "SILVER")} x ${formatTunch(s.silverTunchScaled ?? 0)} = ` : ""}${g3(s.silverFineMg, "SILVER")} fine`);
  }
  const c = v.conversion;
  if (c) {
    const qty = c.direction === "METAL_TO_CASH"
      ? `${g3(c.fineMg, c.metalType)} ${c.metalType.toLowerCase()} -> ${rs2(c.cashPaise)}`
      : `${rs2(c.cashPaise)} -> ${g3(c.fineMg, c.metalType)} ${c.metalType.toLowerCase()}`;
    out.push(`${qty} @ ${ratePdf(c.rateAmountPaise, c.rateUnit)}`);
    out.push(c.side === "PARTY_OWES" ? "Settled from party due" : "Settled from our due");
  }
  if (v.notes) out.push(`Note: ${v.notes}`);
  return out;
}

const ACCENT = "#7c2d12";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1c1917", backgroundColor: "#ffffff" },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandTop: { fontSize: 11, fontWeight: "bold", letterSpacing: 4, color: ACCENT, textAlign: "center", marginBottom: 6 },
  shop: { fontSize: 22, fontWeight: "bold", color: ACCENT },
  shopSub: { marginTop: 4, fontSize: 9.5, color: "#57534e" },
  brand: { marginTop: 4, fontSize: 8.5, color: "#a8a29e" },
  docTitle: { fontSize: 10.5, fontWeight: "bold", letterSpacing: 2, color: "#57534e", textAlign: "right" },
  docNo: { marginTop: 2, fontSize: 12, fontWeight: "bold", textAlign: "right" },
  docGen: { marginTop: 2, fontSize: 9.5, color: "#57534e", textAlign: "right" },
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
  headCell: { fontSize: 8.5, fontWeight: "bold", letterSpacing: 1.5, color: "#57534e" },
  dayBar: { marginTop: 8, backgroundColor: "#1c1917", color: "#ffffff", paddingVertical: 4, paddingHorizontal: 8, fontWeight: "bold", fontSize: 10 },
  row: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4" },
  particulars: { flex: 1, paddingRight: 8 },
  sno: { width: 34, fontSize: 10, color: "#78716c" },
  rowHead: { fontWeight: "bold", fontSize: 10.5 },
  detail: { marginTop: 1, fontSize: 9.5, color: "#57534e" },
  amt: { width: 90, textAlign: "right", fontWeight: "bold", fontSize: 9.5 },
  balStrip: { backgroundColor: "#f5f0e8", paddingVertical: 4, paddingHorizontal: 8, flexDirection: "row", justifyContent: "space-between" },
  totalBox: { marginTop: 8, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#e7e5e4", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, flexDirection: "row", justifyContent: "space-between" },
  balTitle: { fontWeight: "bold" },
  balVals: { color: "#57534e" },
  legend: { marginTop: 10, fontSize: 9, color: "#57534e" },
  closingBox: { marginTop: 12, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 8, padding: 12 },
  closingTitle: { fontSize: 9.5, fontWeight: "bold", letterSpacing: 1.5, color: ACCENT },
  closingRow: { marginTop: 8, flexDirection: "row" },
  closingCell: { flex: 1 },
  closingLabel: { fontSize: 9.5, color: "#57534e" },
  closingVal: { marginTop: 2, fontSize: 17, fontWeight: "bold" },
  footer: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  footerNote: { flex: 1, fontSize: 9, color: "#57534e", paddingRight: 16 },
  sign: { fontSize: 9.5, color: "#57534e", textAlign: "right" },
});

export interface StatementDocProps {
  shop: ShopDetails;
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
  grossIn: BalanceDelta;
  grossOut: BalanceDelta;
  closing: BalanceDelta;
  closingLabel: string;
  metals: { gold: boolean; silver: boolean };
}

function CloseCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.closingCell}>
      <Text style={s.closingLabel}>{label}</Text>
      <Text style={s.closingVal}>{value}</Text>
    </View>
  );
}

export function StatementDoc(p: StatementDocProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brandTop}>JEWELR</Text>
        <View style={s.topRow}>
          <View>
            <Text style={s.shop}>{shopNameOf(p.shop)}</Text>
            {shopSubLine(p.shop) ? <Text style={s.shopSub}>{shopSubLine(p.shop)}</Text> : null}
            <Text style={s.brand}>Statement by {APP_BRAND}</Text>
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
        <View style={s.closingBox} wrap={false}>
          <Text style={s.closingTitle}>{p.openingLabel}</Text>
          <View style={s.closingRow}>
            <CloseCell label="Cash" value={signed2(p.opening.cashPaise)} />
            {p.metals.gold ? (
              <CloseCell label="Gold fine" value={signedG3(p.opening.goldFineMg, "GOLD")} />
            ) : null}
            {p.metals.silver ? (
              <CloseCell label="Silver fine" value={signedG3(p.opening.silverFineMg, "SILVER")} />
            ) : null}
          </View>
        </View>
        <View style={s.head}>
          <Text style={[s.headCell, { width: 34 }]}>NO.</Text>
          <Text style={[s.headCell, { flex: 1 }]}>PARTICULARS</Text>
          <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>CASH Rs</Text>
          {p.metals.gold ? <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>GOLD (g)</Text> : null}
          {p.metals.silver ? <Text style={[s.headCell, { width: 90, textAlign: "right" }]}>SILVER (g)</Text> : null}
        </View>
        {p.days.length === 0 ? (
          <View style={s.row}><Text style={s.detail}>No entries in this period — opening and closing match.</Text></View>
        ) : null}
        {p.days.map((d) => (
          <View key={d.date} wrap={false}>
            <Text style={s.dayBar}>{d.date}</Text>
            {d.rows.map((r) => (
              <View key={r.sno} style={s.row}>
                <Text style={s.sno}>{r.sno}</Text>
                <View style={s.particulars}>
                  <Text style={s.rowHead}>{r.head}</Text>
                  {r.details.map((ln, i) => <Text key={i} style={s.detail}>{ln}</Text>)}
                </View>
                <Text style={s.amt}>{signed2(r.cash)}</Text>
                {p.metals.gold ? <Text style={s.amt}>{signedG3(r.gold, "GOLD")}</Text> : null}
                {p.metals.silver ? <Text style={s.amt}>{signedG3(r.silver, "SILVER")}</Text> : null}
              </View>
            ))}
            <View style={s.balStrip}>
              <Text style={s.balTitle}>Balance after {d.date}</Text>
              <Text style={s.balVals}>
                Cash {signed2(d.balCash)}
                {p.metals.gold ? ` · Gold ${signedG3(d.balGold, "GOLD")}` : ""}
                {p.metals.silver ? ` · Silver ${signedG3(d.balSilver, "SILVER")}` : ""}
              </Text>
            </View>
          </View>
        ))}
        <View style={s.totalBox} wrap={false}>
          <Text style={s.balTitle}>Period move · net</Text>
          <View>
            <Text style={[s.balVals, { textAlign: "right" }]}>Cash {signed2(p.totals.cashPaise)}</Text>
            {p.metals.gold ? <Text style={[s.balVals, { textAlign: "right" }]}>Gold {signedG3(p.totals.goldFineMg, "GOLD")}</Text> : null}
            {p.metals.silver ? <Text style={[s.balVals, { textAlign: "right" }]}>Silver {signedG3(p.totals.silverFineMg, "SILVER")}</Text> : null}
            <Text style={[s.balVals, { textAlign: "right" }]}>In {rs2(p.grossIn.cashPaise)} / Out {rs2(Math.abs(p.grossOut.cashPaise))}</Text>
          </View>
        </View>
        <Text style={s.legend}>
          + adds to due · - reduces due.
          {!p.metals.gold ? " Gold: no entries this period." : ""}
          {!p.metals.silver ? " Silver: no entries this period." : ""}
        </Text>
        <View style={s.closingBox} wrap={false}>
          <Text style={s.closingTitle}>{p.closingLabel}</Text>
          <View style={s.closingRow}>
            <CloseCell label="Cash" value={signed2(p.closing.cashPaise)} />
            {p.metals.gold ? (
              <CloseCell label="Gold fine" value={signedG3(p.closing.goldFineMg, "GOLD")} />
            ) : null}
            {p.metals.silver ? (
              <CloseCell label="Silver fine" value={signedG3(p.closing.silverFineMg, "SILVER")} />
            ) : null}
          </View>
        </View>
        <View style={s.footer}>
          <Text style={s.footerNote}>Balance as per our books. Please report any difference within 7 days of receiving this statement.</Text>
          <View>
            <Text style={s.sign}>For {shopNameOf(p.shop)}{"\n"}Authorised signature</Text>
            <Text style={[s.sign, { marginTop: 8 }]} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </View>
      </Page>
    </Document>
  );
}

export type { StatementRow };
