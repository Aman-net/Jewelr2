import { tradeMoves } from "../domain/index.ts";
import type { TradeMove, Voucher } from "../domain/index.ts";
import { roundMetalMg } from "../domain/numeric/rounding.ts";
import { uuid } from "../lib/uuid.ts";
import { db } from "./db.ts";
import type { JewelrDb, StockEntryRow } from "./db.ts";

export interface StockBucket {
  metal: "GOLD" | "SILVER";
  /** Display spelling from the latest movement. */
  name: string;
  physicalMg: number;
  /** Piece count, or null when no movement carries a count. */
  pcs: number | null;
  fineMg: number;
}

export interface StockMove extends StockEntryRow {
  /** Voucher type for trade rows (SALE/PURCHASE/REVERSAL derivation). */
  voucherType?: string;
}

const bucketKey = (metal: string, name: string) => `${metal}|${name.trim().toLowerCase()}`;

/** Aggregate rows into per-(metal, item) buckets. Names match case-insensitively. */
export function aggregateStock(rows: StockEntryRow[]): StockBucket[] {
  const map = new Map<string, StockBucket>();
  // Chronological so the display spelling is always the latest movement's.
  const ordered = [...rows].sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt.localeCompare(b.createdAt)
      : a.businessDate.localeCompare(b.businessDate),
  );
  for (const r of ordered) {
    const key = bucketKey(r.metal, r.itemName);
    const prev = map.get(key) ?? {
      metal: r.metal as StockBucket["metal"],
      name: r.itemName,
      physicalMg: 0,
      pcs: null,
      fineMg: 0,
    };
    prev.name = r.itemName;
    prev.physicalMg += r.physicalDeltaMg;
    if (r.hasPcs) prev.pcs = (prev.pcs ?? 0) + r.pcsDelta;
    prev.fineMg += r.fineDeltaMg;
    map.set(key, prev);
  }
  return [...map.values()].sort((a, b) => a.metal.localeCompare(b.metal) || a.name.localeCompare(b.name));
}

/** Current shop stock across all buckets. */
export async function getStock(dbx: JewelrDb = db): Promise<StockBucket[]> {
  return aggregateStock(await dbx.stock_entries.toArray());
}

/** Movements for one bucket, chronological, with voucher types for trade rows. */
export async function getStockMoves(metal: string, name: string, dbx: JewelrDb = db): Promise<StockMove[]> {
  const key = bucketKey(metal, name);
  const rows = (await dbx.stock_entries.toArray()).filter((r) => bucketKey(r.metal, r.itemName) === key);
  rows.sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.createdAt === b.createdAt
        ? a.id.localeCompare(b.id)
        : a.createdAt.localeCompare(b.createdAt)
      : a.businessDate.localeCompare(b.businessDate),
  );
  const vouchers = new Map((await dbx.vouchers.toArray()).map((v) => [v.id, v.type]));
  return rows.map((r) => ({ ...r, voucherType: r.voucherId ? vouchers.get(r.voucherId) : undefined }));
}

/** Stock rows for a posted trade voucher (signed by shelf direction). */
export function tradeRowsFor(voucher: Voucher): Omit<StockEntryRow, "id">[] {
  return tradeMoves(voucher).map((m: TradeMove) => ({
    voucherId: voucher.id,
    metal: m.metalType,
    itemName: m.itemName,
    physicalDeltaMg: m.physicalMg,
    pcsDelta: m.pcs,
    hasPcs: m.hasPcs,
    fineDeltaMg: m.fineMg,
    businessDate: voucher.businessDate,
    createdAt: voucher.createdAt,
  }));
}

/** Negate stored trade rows (reversal path). Must run inside the posting transaction. */
export async function negateTradeStock(
  dbx: JewelrDb,
  originalVoucherId: string,
  newVoucherId: string,
  businessDate: string,
  createdAt: string,
): Promise<void> {
  const rows = await dbx.stock_entries.where("voucherId").equals(originalVoucherId).toArray();
  if (rows.length === 0) return;
  await dbx.stock_entries.bulkAdd(
    rows.map((r) => ({
      ...r,
      id: uuid(),
      voucherId: newVoucherId,
      physicalDeltaMg: -r.physicalDeltaMg,
      pcsDelta: -r.pcsDelta,
      fineDeltaMg: -r.fineDeltaMg,
      businessDate,
      createdAt,
    })),
  );
}

function assertDate(businessDate: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) throw new Error(`Invalid date: ${businessDate}`);
}

export interface SeedItem {
  metal: "GOLD" | "SILVER";
  name: string;
  physicalMg: number;
  pcs?: number;
  /** Agreed purity for the fine snapshot. No silent default — the form prefills 100%. */
  tunchScaled: number;
}

/**
 * Seed counted stock (opening count, found stock). Additive — recounts and
 * corrections go through adjustStock, never by editing rows.
 */
export async function seedStock(
  items: SeedItem[],
  businessDate: string,
  reason: string | undefined,
  dbx: JewelrDb = db,
): Promise<StockEntryRow[]> {
  assertDate(businessDate);
  if (items.length === 0) throw new Error("Add at least one item");
  const createdAt = new Date().toISOString();
  const rows = items.map((it) => {
    if (!it.name.trim()) throw new Error("Item name is required");
    if (it.physicalMg <= 0) throw new Error(`${it.name}: weight must be positive`);
    const physicalMg = roundMetalMg(it.physicalMg, it.metal);
    return {
      id: uuid(),
      voucherId: null,
      metal: it.metal,
      itemName: it.name.trim(),
      physicalDeltaMg: physicalMg,
      pcsDelta: it.pcs ?? 0,
      hasPcs: it.pcs !== undefined,
      fineDeltaMg: roundMetalMg(Math.round((physicalMg * it.tunchScaled) / 10_000), it.metal),
      businessDate,
      reason: reason?.trim() || "Opening count",
      createdAt,
    };
  });
  await dbx.stock_entries.bulkAdd(rows);
  return rows;
}

export interface AdjustInput {
  metal: "GOLD" | "SILVER";
  name: string;
  /** Signed quantities: positive adds, negative removes. */
  physicalDeltaMg: number;
  pcsDelta?: number;
  tunchScaled: number;
  businessDate: string;
  reason: string;
}

/** Manual correction (damage, loss, found, re-weigh). Reason is required — history must explain itself. */
export async function adjustStock(input: AdjustInput, dbx: JewelrDb = db): Promise<StockEntryRow> {
  assertDate(input.businessDate);
  if (!input.name.trim()) throw new Error("Item name is required");
  if (!input.reason.trim()) throw new Error("A reason is required for stock adjustments");
  if (input.physicalDeltaMg === 0) throw new Error("Adjustment quantity cannot be zero");
  const physicalDeltaMg = roundMetalMg(input.physicalDeltaMg, input.metal);
  if (physicalDeltaMg === 0) throw new Error("Adjustment is below 1 g — silver rounds to whole grams");
  const row: StockEntryRow = {
    id: uuid(),
    voucherId: null,
    metal: input.metal,
    itemName: input.name.trim(),
    physicalDeltaMg,
    pcsDelta: input.pcsDelta ?? 0,
    hasPcs: input.pcsDelta !== undefined,
    fineDeltaMg: roundMetalMg(Math.round((Math.abs(physicalDeltaMg) * input.tunchScaled) / 10_000), input.metal) * Math.sign(physicalDeltaMg),
    businessDate: input.businessDate,
    reason: input.reason.trim(),
    createdAt: new Date().toISOString(),
  };
  await dbx.stock_entries.add(row);
  return row;
}

export interface ShortLine {
  metal: string;
  name: string;
  needMg: number;
  haveMg: number;
}

/**
 * Warn-only short check for SALE review: lines needing more than the shelf
 * holds. Never blocks — unrecorded purchases must not freeze billing.
 */
export function checkShortSale(
  lines: Array<{ metalType: string; categoryName: string; physicalMg: number }>,
  stock: StockBucket[],
): ShortLine[] {
  const have = new Map(stock.map((b) => [bucketKey(b.metal, b.name), b.physicalMg]));
  const shorts: ShortLine[] = [];
  for (const l of lines) {
    const h = have.get(bucketKey(l.metalType, l.categoryName)) ?? 0;
    if (h < l.physicalMg) shorts.push({ metal: l.metalType, name: l.categoryName, needMg: l.physicalMg, haveMg: h });
  }
  return shorts;
}

/**
 * Recompute expected trade rows from live vouchers (reversed vouchers
 * excluded) for the rebuild comparison in tests.
 */
export async function recomputeTradeStock(dbx: JewelrDb): Promise<Omit<StockEntryRow, "id" | "createdAt">[]> {
  const [vouchers, lines] = await Promise.all([dbx.vouchers.toArray(), dbx.voucher_lines.toArray()]);
  const reversed = new Set(vouchers.filter((v) => v.reversesVoucherId).map((v) => v.reversesVoucherId as string));
  const byVoucher = new Map<string, typeof lines>();
  for (const l of lines) {
    const list = byVoucher.get(l.voucherId) ?? [];
    list.push(l);
    byVoucher.set(l.voucherId, list);
  }
  const expected: Omit<StockEntryRow, "id" | "createdAt">[] = [];
  for (const v of vouchers) {
    if (v.type !== "SALE" && v.type !== "PURCHASE") continue;
    if (reversed.has(v.id)) continue;
    const sign = v.type === "PURCHASE" ? 1 : -1;
    for (const l of (byVoucher.get(v.id) ?? []).sort((a, b) => a.id.localeCompare(b.id))) {
      expected.push({
        voucherId: v.id,
        metal: l.metalType,
        itemName: l.categoryName,
        physicalDeltaMg: sign * l.physicalMg,
        pcsDelta: sign * (l.itemCount ?? 0),
        hasPcs: l.itemCount !== undefined,
        fineDeltaMg: sign * l.fineMg,
        businessDate: v.businessDate,
      });
    }
  }
  return expected;
}

// --- Item config: default tunch + low-stock levels (master only, history untouched) ---

export interface ItemCfg {
  defaultTunchScaled?: number;
  lowMg?: number;
  lowPcs?: number;
}

const cfgKeyFor = (metal: string, name: string) => `itemCfg:${metal}:${name.trim().toLowerCase()}`;

function parseCfg(value: string | undefined): ItemCfg {
  if (!value) return {};
  try {
    const r = JSON.parse(value) as ItemCfg;
    return {
      ...(typeof r.defaultTunchScaled === "number" ? { defaultTunchScaled: r.defaultTunchScaled } : {}),
      ...(typeof r.lowMg === "number" ? { lowMg: r.lowMg } : {}),
      ...(typeof r.lowPcs === "number" ? { lowPcs: r.lowPcs } : {}),
    };
  } catch {
    return {};
  }
}

export async function getItemCfg(metal: string, name: string, dbx: JewelrDb = db): Promise<ItemCfg> {
  if (!name.trim()) return {};
  return parseCfg((await dbx.app_settings.get(cfgKeyFor(metal, name)))?.value);
}

export async function setItemCfg(
  metal: "GOLD" | "SILVER",
  name: string,
  patch: ItemCfg,
  dbx: JewelrDb = db,
): Promise<ItemCfg> {
  if (!name.trim()) throw new Error("Item name is required");
  const clean: ItemCfg = {};
  if (patch.defaultTunchScaled !== undefined) {
    if (patch.defaultTunchScaled <= 0 || patch.defaultTunchScaled > 10_000) throw new Error("Default tunch must be 0–100%");
    clean.defaultTunchScaled = patch.defaultTunchScaled;
  }
  if (patch.lowMg !== undefined) {
    if (patch.lowMg < 0) throw new Error("Low-stock weight cannot be negative");
    clean.lowMg = roundMetalMg(patch.lowMg, metal);
  }
  if (patch.lowPcs !== undefined) {
    if (!Number.isInteger(patch.lowPcs) || patch.lowPcs < 0) throw new Error("Low-stock pieces must be a whole number");
    clean.lowPcs = patch.lowPcs;
  }
  const next = { ...(await getItemCfg(metal, name, dbx)), ...clean };
  // Clearing: explicit undefined removes the key.
  for (const k of ["defaultTunchScaled", "lowMg", "lowPcs"] as const) {
    if (patch[k] === undefined && k in patch) delete next[k];
  }
  if (Object.keys(next).length === 0) {
    await dbx.app_settings.delete(cfgKeyFor(metal, name));
  } else {
    await dbx.app_settings.put({ key: cfgKeyFor(metal, name), value: JSON.stringify(next) });
  }
  return next;
}

/** Move config to a renamed item (master only — posted history keeps its strings). */
export async function moveItemCfg(metal: string, oldName: string, newName: string, dbx: JewelrDb = db): Promise<void> {
  const cfg = await getItemCfg(metal, oldName, dbx);
  if (Object.keys(cfg).length === 0) return;
  await dbx.app_settings.put({ key: cfgKeyFor(metal, newName), value: JSON.stringify(cfg) });
  await dbx.app_settings.delete(cfgKeyFor(metal, oldName));
}

/** Drop config with a deleted item. */
export async function clearItemCfg(metal: string, name: string, dbx: JewelrDb = db): Promise<void> {
  await dbx.app_settings.delete(cfgKeyFor(metal, name));
}

/** True when a bucket sits below any configured low-stock level. */
export function isLowStock(b: StockBucket, cfg: ItemCfg): boolean {
  if (cfg.lowMg !== undefined && b.physicalMg < cfg.lowMg) return true;
  if (cfg.lowPcs !== undefined && (b.pcs ?? Number.MAX_SAFE_INTEGER) < cfg.lowPcs) return true;
  return false;
}
