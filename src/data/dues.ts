import { db } from "./db.ts";
import type { JewelrDb, LedgerEntryRow, VoucherRow } from "./db.ts";
import type { BalanceDelta } from "../domain/index.ts";

/**
 * Trade-dues split (owner-confirmed): sale-dues = SALE minus RECEIPTs,
 * purchase-dues = PURCHASE minus PAYMENTs. Receipts land in the sale bucket
 * and payments in the purchase bucket by default (running account — no
 * bill-wise matching). Reversals follow their original's bucket. Opening,
 * conversions, and adjustments live in combined only: an opening balance
 * can't be attributed to one trade side.
 */
export interface DuesSplit {
  sale: BalanceDelta;
  purchase: BalanceDelta;
  combined: BalanceDelta;
}

const zero = (): BalanceDelta => ({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });

function build(rows: LedgerEntryRow[], vouchers: VoucherRow[]): Map<string, DuesSplit> {
  const typeOf = new Map(vouchers.map((v) => [v.id, v]));
  const out = new Map<string, DuesSplit>();
  const forParty = (partyId: string): DuesSplit => {
    let s = out.get(partyId);
    if (!s) {
      s = { sale: zero(), purchase: zero(), combined: zero() };
      out.set(partyId, s);
    }
    return s;
  };
  for (const e of rows) {
    const split = forParty(e.partyId);
    split.combined.cashPaise += e.cashDeltaPaise;
    split.combined.goldFineMg += e.goldFineDeltaMg;
    split.combined.silverFineMg += e.silverFineDeltaMg;
    const v = typeOf.get(e.voucherId);
    let type = v?.type;
    if (type === "REVERSAL" && v?.reversesVoucherId) {
      type = typeOf.get(v.reversesVoucherId)?.type;
    }
    const bucket = type === "SALE" || type === "RECEIPT"
      ? split.sale
      : type === "PURCHASE" || type === "PAYMENT"
        ? split.purchase
        : null;
    if (bucket) {
      bucket.cashPaise += e.cashDeltaPaise;
      bucket.goldFineMg += e.goldFineDeltaMg;
      bucket.silverFineMg += e.silverFineDeltaMg;
    }
  }
  return out;
}

const empty = (): DuesSplit => ({ sale: zero(), purchase: zero(), combined: zero() });

export async function getDuesSplit(partyId: string, dbx: JewelrDb = db): Promise<DuesSplit> {
  const [entries, vouchers] = await Promise.all([
    dbx.ledger_entries.where("partyId").equals(partyId).toArray(),
    dbx.vouchers.where("partyId").equals(partyId).toArray(),
  ]);
  return build(entries, vouchers).get(partyId) ?? empty();
}

/** Split dues for every party with ledger entries. One pass — feeds Home rows. */
export async function getAllDuesSplits(dbx: JewelrDb = db): Promise<Record<string, DuesSplit>> {
  const [entries, vouchers] = await Promise.all([dbx.ledger_entries.toArray(), dbx.vouchers.toArray()]);
  return Object.fromEntries(build(entries, vouchers));
}
