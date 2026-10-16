import type { BalanceDelta } from "../domain/index.ts";
import { getBalancesAsOf, getLedger } from "./ledger.ts";
import type { LedgerRow } from "./ledger.ts";
import { db } from "./db.ts";
import type { JewelrDb } from "./db.ts";

export interface StatementRow {
  voucherId: string;
  businessDate: string;
  description: string;
  /** Plain voucher type (SALE, RECEIPT…) for intuitive labels. */
  type: string;
  referenceNumber?: string;
  /** Paper row number, 1-based chronological. Pairs consume two numbers. */
  serial: number;
  /**
   * Collapsed reversal: this row already nets the original with its reversal
   * (reversals carry the original's date, so pairs always co-locate).
   * otherSerial is the reversal's number; reason travels for display.
   */
  pair?: { otherSerial: number; reason?: string };
  createdAt: string;
  cashDeltaPaise: number;
  goldFineDeltaMg: number;
  silverFineDeltaMg: number;
  balCashPaise: number;
  balGoldFineMg: number;
  balSilverFineMg: number;
}

/**
 * Date-range khata statement (owner-confirmed bill shape).
 * Opening = balance the day before `from` (empty `from` = whole khata, opening zero).
 * Rows = posted ledger deltas in range with running balances from opening.
 * Closing = opening + period totals. Columns never net across cash/gold/silver.
 */
export interface Statement {
  partyId: string;
  from: string;
  to: string;
  opening: BalanceDelta;
  rows: StatementRow[];
  totals: BalanceDelta;
  /** Gross volumes (Khatabook-style): sums of positive / negative moves. */
  grossIn: BalanceDelta;
  grossOut: BalanceDelta;
  /** A metal shows only when nonzero in opening, any row, or closing. */
  metals: { gold: boolean; silver: boolean };
  closing: BalanceDelta;
}

/** Day before a YYYY-MM-DD date, in the same format. */
export function prevDay(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) - 86_400_000;
  const dt = new Date(t);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

/** First day of the month containing a YYYY-MM-DD date. */
export function firstOfMonth(yyyyMmDd: string): string {
  return `${yyyyMmDd.slice(0, 7)}-01`;
}

export function buildStatement(
  partyId: string,
  from: string,
  to: string,
  opening: BalanceDelta,
  entries: Array<LedgerRow & { type?: string; referenceNumber?: string; reversesVoucherId?: string; reversalReason?: string }>,
): Statement {
  const rows: StatementRow[] = [];
  let cash = opening.cashPaise;
  let gold = opening.goldFineMg;
  let silver = opening.silverFineMg;
  const grossIn: BalanceDelta = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  const grossOut: BalanceDelta = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  for (const e of entries) {
    cash += e.cashDeltaPaise;
    gold += e.goldFineDeltaMg;
    silver += e.silverFineDeltaMg;
    if (e.cashDeltaPaise > 0) grossIn.cashPaise += e.cashDeltaPaise;
    else grossOut.cashPaise += e.cashDeltaPaise;
    if (e.goldFineDeltaMg > 0) grossIn.goldFineMg += e.goldFineDeltaMg;
    else grossOut.goldFineMg += e.goldFineDeltaMg;
    if (e.silverFineDeltaMg > 0) grossIn.silverFineMg += e.silverFineDeltaMg;
    else grossOut.silverFineMg += e.silverFineDeltaMg;
    rows.push({
      voucherId: e.voucherId,
      businessDate: e.businessDate,
      description: e.description,
      type: e.type ?? e.description.split(" ")[0] ?? "",
      referenceNumber: e.referenceNumber,
      serial: rows.length + 1,
      createdAt: e.createdAt,
      cashDeltaPaise: e.cashDeltaPaise,
      goldFineDeltaMg: e.goldFineDeltaMg,
      silverFineDeltaMg: e.silverFineDeltaMg,
      balCashPaise: cash,
      balGoldFineMg: gold,
      balSilverFineMg: silver,
    });
  }
  // Collapse each reversal into its original: one paper row, net effect.
  // Sums are identical (d + (−d) = 0), so later running balances don't move.
  const byVoucher = new Map(rows.map((r) => [r.voucherId, r]));
  const reverses = new Map<string, string>();
  for (const e of entries) {
    if (e.reversesVoucherId) reverses.set(e.voucherId, e.reversesVoucherId);
  }
  const reasons = new Map(
    entries.filter((e) => e.reversalReason).map((e) => [e.voucherId, e.reversalReason as string]),
  );
  const collapsed: StatementRow[] = [];
  const consumed = new Set<string>();
  for (const r of rows) {
    if (consumed.has(r.voucherId)) continue;
    const revId = [...reverses.entries()].find(([, orig]) => orig === r.voucherId)?.[0];
    const rev = revId ? byVoucher.get(revId) : undefined;
    if (rev && !consumed.has(rev.voucherId)) {
      consumed.add(rev.voucherId);
      collapsed.push({
        ...r,
        cashDeltaPaise: r.cashDeltaPaise + rev.cashDeltaPaise,
        goldFineDeltaMg: r.goldFineDeltaMg + rev.goldFineDeltaMg,
        silverFineDeltaMg: r.silverFineDeltaMg + rev.silverFineDeltaMg,
        balCashPaise: rev.balCashPaise,
        balGoldFineMg: rev.balGoldFineMg,
        balSilverFineMg: rev.balSilverFineMg,
        pair: { otherSerial: rev.serial, reason: reasons.get(rev.voucherId) },
      });
    } else {
      collapsed.push(r);
    }
  }
  const totals: BalanceDelta = {
    cashPaise: cash - opening.cashPaise,
    goldFineMg: gold - opening.goldFineMg,
    silverFineMg: silver - opening.silverFineMg,
  };
  const closing = { cashPaise: cash, goldFineMg: gold, silverFineMg: silver };
  const present = (v: number) => v !== 0;
  return {
    partyId,
    from,
    to,
    opening: { ...opening },
    rows: collapsed,
    totals,
    grossIn,
    grossOut,
    metals: {
      gold: present(opening.goldFineMg) || present(closing.goldFineMg) || collapsed.some((r) => present(r.goldFineDeltaMg)),
      silver: present(opening.silverFineMg) || present(closing.silverFineMg) || collapsed.some((r) => present(r.silverFineDeltaMg)),
    },
    closing,
  };
}

/**
 * Live statement query. Empty `from` means the whole khata (opening is zero).
 * Throws when from > to.
 */
export async function getStatement(
  partyId: string,
  from: string,
  to: string,
  dbx: JewelrDb = db,
): Promise<Statement> {
  if (from && to && from > to) throw new Error("Bill start date is after end date");
  const opening = from
    ? await getBalancesAsOf(partyId, prevDay(from), dbx)
    : { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  const entries = await getLedger(
    partyId,
    { from: from || undefined, to: to || undefined },
    dbx,
  );
  // Plain type + bill no. for intuitive row labels (avoids app-speak descriptions).
  const vouchers = await dbx.vouchers.where("partyId").equals(partyId).toArray();
  const byId = new Map(vouchers.map((v) => [v.id, v]));
  const enriched = entries.map((e) => ({
    ...e,
    type: byId.get(e.voucherId)?.type ?? e.description.split(" ")[0] ?? "",
    referenceNumber: byId.get(e.voucherId)?.referenceNumber,
    reversesVoucherId: byId.get(e.voucherId)?.reversesVoucherId,
    reversalReason: byId.get(e.voucherId)?.reversalReason,
  }));
  return buildStatement(partyId, from, to, opening, enriched);
}
