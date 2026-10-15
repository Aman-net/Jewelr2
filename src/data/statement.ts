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
  entries: Array<LedgerRow & { type?: string; referenceNumber?: string }>,
): Statement {
  const rows: StatementRow[] = [];
  let cash = opening.cashPaise;
  let gold = opening.goldFineMg;
  let silver = opening.silverFineMg;
  for (const e of entries) {
    cash += e.cashDeltaPaise;
    gold += e.goldFineDeltaMg;
    silver += e.silverFineDeltaMg;
    rows.push({
      voucherId: e.voucherId,
      businessDate: e.businessDate,
      description: e.description,
      type: e.type ?? e.description.split(" ")[0] ?? "",
      referenceNumber: e.referenceNumber,
      createdAt: e.createdAt,
      cashDeltaPaise: e.cashDeltaPaise,
      goldFineDeltaMg: e.goldFineDeltaMg,
      silverFineDeltaMg: e.silverFineDeltaMg,
      balCashPaise: cash,
      balGoldFineMg: gold,
      balSilverFineMg: silver,
    });
  }
  const totals: BalanceDelta = {
    cashPaise: cash - opening.cashPaise,
    goldFineMg: gold - opening.goldFineMg,
    silverFineMg: silver - opening.silverFineMg,
  };
  return {
    partyId,
    from,
    to,
    opening: { ...opening },
    rows,
    totals,
    closing: { cashPaise: cash, goldFineMg: gold, silverFineMg: silver },
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
  }));
  return buildStatement(partyId, from, to, opening, enriched);
}
