import { sumEntries } from "../domain/index.ts";
import type { BalanceDelta, LedgerEntryDelta } from "../domain/index.ts";
import { db } from "./db.ts";
import type { JewelrDb, VoucherRow } from "./db.ts";
import { recomputeEntry } from "./vouchers.ts";

export interface LedgerFilter {
  from?: string;
  to?: string;
  types?: string[];
}

function toDelta(e: {
  voucherId: string;
  partyId: string;
  businessDate: string;
  cashDeltaPaise: number;
  goldFineDeltaMg: number;
  silverFineDeltaMg: number;
  description: string;
}): LedgerEntryDelta {
  return {
    voucherId: e.voucherId,
    partyId: e.partyId,
    businessDate: e.businessDate,
    cashDeltaPaise: e.cashDeltaPaise,
    goldFineDeltaMg: e.goldFineDeltaMg,
    silverFineDeltaMg: e.silverFineDeltaMg,
    description: e.description,
  };
}

function chronological(rows: { businessDate: string; createdAt: string; voucherId: string }[]) {
  return rows.sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.createdAt === b.createdAt
        ? a.voucherId.localeCompare(b.voucherId)
        : a.createdAt.localeCompare(b.createdAt)
      : a.businessDate.localeCompare(b.businessDate),
  );
}

/**
 * Party ledger, chronological. Filter by date range and voucher type.
 * Balances stay exact: rows are summed, never stored.
 */
export async function getLedger(
  partyId: string,
  filter: LedgerFilter = {},
  dbx: JewelrDb = db,
): Promise<LedgerEntryDelta[]> {
  let rows = await dbx.ledger_entries.where("partyId").equals(partyId).toArray();
  if (filter.from) rows = rows.filter((r) => r.businessDate >= (filter.from as string));
  if (filter.to) rows = rows.filter((r) => r.businessDate <= (filter.to as string));
  if (filter.types && filter.types.length > 0) {
    const byId = new Map<string, VoucherRow>();
    const vouchers = await dbx.vouchers.where("partyId").equals(partyId).toArray();
    for (const v of vouchers) byId.set(v.id, v);
    const set = new Set(filter.types);
    rows = rows.filter((r) => set.has(byId.get(r.voucherId)?.type ?? ""));
  }
  chronological(rows);
  return rows.map(toDelta);
}

export async function getBalances(partyId: string, dbx: JewelrDb = db): Promise<BalanceDelta> {
  const rows = await dbx.ledger_entries.where("partyId").equals(partyId).toArray();
  return sumEntries(rows);
}

/** Balance as of date D = entries with businessDate <= D (backdated entries included). */
export async function getBalancesAsOf(
  partyId: string,
  date: string,
  dbx: JewelrDb = db,
): Promise<BalanceDelta> {
  const rows = await dbx.ledger_entries.where("partyId").equals(partyId).toArray();
  return sumEntries(rows.filter((r) => r.businessDate <= date));
}

/** Current balances for every party that has ledger entries. */
export async function getAllBalances(dbx: JewelrDb = db): Promise<Record<string, BalanceDelta>> {
  const rows = await dbx.ledger_entries.toArray();
  const totals: Record<string, BalanceDelta> = {};
  for (const r of rows) {
    const prev = totals[r.partyId] ?? { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
    totals[r.partyId] = {
      cashPaise: prev.cashPaise + r.cashDeltaPaise,
      goldFineMg: prev.goldFineMg + r.goldFineDeltaMg,
      silverFineMg: prev.silverFineMg + r.silverFineDeltaMg,
    };
  }
  return totals;
}

/**
 * Recompute every ledger entry from vouchers through the domain engine.
 * Ledger entries are derived — this must always equal the stored entries
 * (asserted in tests).
 */
export async function rebuildLedger(dbx: JewelrDb = db): Promise<LedgerEntryDelta[]> {
  const vouchers = await dbx.vouchers.toArray();
  const rebuilt: LedgerEntryDelta[] = [];
  for (const row of vouchers) {
    rebuilt.push(await recomputeEntry(dbx, row.id));
  }
  rebuilt.sort((a, b) => a.voucherId.localeCompare(b.voucherId));
  return rebuilt;
}

/** Stored entries in voucher-id order, for comparison against rebuildLedger(). */
export async function storedEntriesByVoucher(dbx: JewelrDb = db): Promise<LedgerEntryDelta[]> {
  const rows = await dbx.ledger_entries.toArray();
  rows.sort((a, b) => a.voucherId.localeCompare(b.voucherId));
  return rows.map(toDelta);
}
