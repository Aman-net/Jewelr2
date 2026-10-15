import {
  buildReversal,
  buildVoucher,
  negateDeltas,
  voucherDeltas,
} from "../domain/index.ts";
import type {
  BalanceDelta,
  ConversionInput,
  LedgerEntryDelta,
  MiscChargeInput,
  SalePurchaseLine,
  SalePurchaseLineInput,
  SettlementInput,
  Voucher,
  VoucherInput,
  VoucherType,
} from "../domain/index.ts";
import type { Table } from "dexie";
import { uuid } from "../lib/uuid.ts";
import { recordCategoryUse } from "./categories.ts";
import { negateTradeStock, tradeRowsFor } from "./stock.ts";
import { SHOP_ID, db } from "./db.ts";
import type {
  ConversionRow,
  JewelrDb,
  LedgerEntryRow,
  ManualDeltaRow,
  MiscChargeRow,
  SettlementRow,
  VoucherLineRow,
  VoucherRow,
} from "./db.ts";

export interface PostVoucherInput {
  /** Client-generated UUID (created when the form opens). Omitted → generated. */
  id?: string;
  type: Exclude<VoucherType, "REVERSAL">;
  partyId: string;
  businessDate: string;
  referenceNumber?: string;
  notes?: string;
  lines?: SalePurchaseLineInput[];
  settlement?: SettlementInput;
  conversion?: ConversionInput;
  opening?: BalanceDelta;
  adjustment?: BalanceDelta;
  misc?: MiscChargeInput[];
  createdAt?: string;
}

export interface PostedVoucher {
  voucher: Voucher;
  entry: LedgerEntryDelta;
  /** True when the id already existed — the post was a no-op. */
  duplicate: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function describeVoucher(v: Voucher): string {
  switch (v.type) {
    case "SALE":
      return `SALE · ${v.lines.length} line(s)`;
    case "PURCHASE":
      return `PURCHASE · ${v.lines.length} line(s)`;
    case "RECEIPT":
      return "RECEIPT";
    case "PAYMENT":
      return "PAYMENT";
    case "CONVERSION":
      return `CONVERSION ${v.conversion?.direction} ${v.conversion?.metalType}`;
    case "OPENING":
      return "OPENING balance";
    case "ADJUSTMENT":
      return "ADJUSTMENT";
    case "REVERSAL":
      return `REVERSAL of ${v.reversesVoucherId} · ${v.reversalReason}`;
  }
}

function toVoucherRow(v: Voucher): VoucherRow {
  return {
    id: v.id,
    shopId: v.shopId,
    type: v.type,
    partyId: v.partyId,
    businessDate: v.businessDate,
    referenceNumber: v.referenceNumber,
    notes: v.notes,
    reversesVoucherId: v.reversesVoucherId,
    reversalReason: v.reversalReason,
    calculationVersion: v.calculationVersion,
    createdAt: v.createdAt,
  };
}

function toLineRow(l: SalePurchaseLine): VoucherLineRow {
  return {
    id: l.id,
    voucherId: l.voucherId,
    metalType: l.metalType,
    categoryName: l.categoryName,
    itemCount: l.itemCount,
    physicalMg: l.physicalMg,
    recordedTunchScaled: l.recordedTunchScaled,
    agreedTunchScaled: l.agreedTunchScaled,
    fineMg: l.fineMg,
    rateAmountPaise: l.rateAmountPaise,
    rateUnit: l.rateUnit,
    pricingMode: l.pricingMode,
    labourPaisePerGram: l.labourPaisePerGram,
    labourMode: l.labourMode,
    labourRatePaise: l.labourRatePaise,
    labourPaise: l.labourPaise,
    lineCashPaise: l.lineCashPaise,
    notes: l.notes,
  };
}

function toEntryRow(e: LedgerEntryDelta, createdAt: string): LedgerEntryRow {
  // One entry per voucher; stable id enables exact rebuild comparison.
  return {
    id: e.voucherId,
    voucherId: e.voucherId,
    partyId: e.partyId,
    businessDate: e.businessDate,
    cashDeltaPaise: e.cashDeltaPaise,
    goldFineDeltaMg: e.goldFineDeltaMg,
    silverFineDeltaMg: e.silverFineDeltaMg,
    description: e.description,
    createdAt,
  };
}

/** Write voucher + parts. Must be called inside a write transaction. */
async function addVoucherParts(
  dbx: JewelrDb,
  voucher: Voucher,
  entry: LedgerEntryDelta,
): Promise<void> {
  await dbx.vouchers.add(toVoucherRow(voucher));
  if (voucher.lines.length > 0) {
    await dbx.voucher_lines.bulkAdd(voucher.lines.map(toLineRow));
  }
  if (voucher.settlement) {
    const s = voucher.settlement;
    const row: SettlementRow = {
      id: uuid(),
      voucherId: voucher.id,
      cashPaise: s.cashPaise,
      goldPhysicalMg: s.goldPhysicalMg,
      goldTunchScaled: s.goldTunchScaled,
      goldFineMg: s.goldFineMg,
      silverPhysicalMg: s.silverPhysicalMg,
      silverTunchScaled: s.silverTunchScaled,
      silverFineMg: s.silverFineMg,
      paymentMode: s.paymentMode,
    };
    await dbx.settlements.add(row);
  }
  if (voucher.conversion) {
    const c = voucher.conversion;
    const row: ConversionRow = {
      id: uuid(),
      voucherId: voucher.id,
      direction: c.direction,
      metalType: c.metalType,
      side: c.side,
      fineMg: c.fineMg,
      rateAmountPaise: c.rateAmountPaise,
      rateUnit: c.rateUnit,
      cashPaise: c.cashPaise,
    };
    await dbx.conversions.add(row);
  }
  if (voucher.opening) {
    const row: ManualDeltaRow = {
      id: uuid(),
      voucherId: voucher.id,
      kind: "OPENING",
      ...voucher.opening,
    };
    await dbx.manual_deltas.add(row);
  }
  if (voucher.adjustment) {
    const row: ManualDeltaRow = {
      id: uuid(),
      voucherId: voucher.id,
      kind: "ADJUSTMENT",
      ...voucher.adjustment,
    };
    await dbx.manual_deltas.add(row);
  }
  if (voucher.misc.length > 0) {
    const rows: MiscChargeRow[] = voucher.misc.map((m: MiscChargeInput) => ({
      id: uuid(),
      voucherId: voucher.id,
      label: m.label,
      cashPaise: m.cashPaise,
    }));
    await dbx.misc_charges.bulkAdd(rows);
  }
  await dbx.ledger_entries.add(toEntryRow(entry, voucher.createdAt));
  // Shelf moves with the khata: trade lines write stock in the same breath.
  const tradeRows = tradeRowsFor(voucher);
  if (tradeRows.length > 0) {
    await dbx.stock_entries.bulkAdd(tradeRows.map((r) => ({ ...r, id: uuid() })));
  }
}

function entryFromDeltas(
  voucher: Voucher,
  deltas: BalanceDelta,
): LedgerEntryDelta {
  return {
    voucherId: voucher.id,
    partyId: voucher.partyId,
    businessDate: voucher.businessDate,
    cashDeltaPaise: deltas.cashPaise,
    goldFineDeltaMg: deltas.goldFineMg,
    silverFineDeltaMg: deltas.silverFineMg,
    description: describeVoucher(voucher),
  };
}

function writeTables(dbx: JewelrDb): Table[] {
  return [
    dbx.vouchers,
    dbx.voucher_lines,
    dbx.settlements,
    dbx.conversions,
    dbx.manual_deltas,
    dbx.misc_charges,
    dbx.stock_entries,
    dbx.ledger_entries,
    dbx.app_settings,
  ];
}

/** Remember used item names for the picker. Runs inside the posting transaction. */
async function rememberCategories(dbx: JewelrDb, voucher: Voucher): Promise<void> {
  for (const l of voucher.lines) {
    await recordCategoryUse(l.metalType, l.categoryName, dbx);
  }
}

/**
 * Role-direction rule (owner-confirmed 2026-10-15): SALE needs a customer,
 * PURCHASE needs a supplier. Money flows (receipt/payment/conversion) and
 * openings stay open to all roles. Unknown parties are rejected outright.
 */
export async function assertRoleDirection(
  dbx: JewelrDb,
  partyId: string,
  type: VoucherType,
): Promise<void> {
  if (type !== "SALE" && type !== "PURCHASE") return;
  const party = await dbx.parties.get(partyId);
  if (!party) throw new Error("Unknown party — create the party first");
  if (type === "SALE" && !party.isCustomer) {
    throw new Error(`${party.name} is not a customer — sales are disabled here`);
  }
  if (type === "PURCHASE" && !party.isSupplier) {
    throw new Error(`${party.name} is not a supplier — purchases are disabled here`);
  }
}

/**
 * Opening balances seed the paper khata exactly once per party — at creation
 * or later with a backdated as-of date. A second live opening is never
 * legitimate (use reversal/replacement or adjustments instead). Reversed
 * openings don't count, so a wrong opening can still be corrected.
 */
export async function assertSingleOpening(
  dbx: JewelrDb,
  partyId: string,
  exceptVoucherId?: string,
): Promise<void> {
  const rows = await dbx.vouchers.where("partyId").equals(partyId).toArray();
  for (const o of rows.filter((r) => r.type === "OPENING" && r.id !== exceptVoucherId)) {
    const reversed = await dbx.vouchers.where("reversesVoucherId").equals(o.id).first();
    if (!reversed) {
      throw new Error("This party already has an opening balance. Reverse it first to correct it.");
    }
  }
}
/**
 * Post a voucher atomically: voucher + lines + parts + ledger entry, all or nothing.
 * Everything is validated and computed BEFORE the transaction opens, so a
 * validation failure writes nothing. Idempotent: an already-existing id is a
 * no-op returning the stored voucher.
 */
export async function postVoucher(input: PostVoucherInput, dbx: JewelrDb = db): Promise<PostedVoucher> {
  const id = input.id ?? uuid();
  const createdAt = input.createdAt ?? nowIso();
  const domainInput: VoucherInput = {
    id,
    shopId: SHOP_ID,
    createdAt,
    referenceNumber: input.referenceNumber,
    notes: input.notes,
    partyId: input.partyId,
    businessDate: input.businessDate,
    type: input.type,
    lines: input.lines,
    settlement: input.settlement,
    conversion: input.conversion,
    opening: input.opening,
    adjustment: input.adjustment,
    misc: input.misc,
  };
  // Pure validation + snapshot computation first — throws before any write.
  const voucher = buildVoucher(domainInput);
  await assertRoleDirection(dbx, voucher.partyId, voucher.type);
  if (voucher.type === "OPENING") {
    await assertSingleOpening(dbx, voucher.partyId);
  }
  const entry = entryFromDeltas(voucher, voucherDeltas(voucher));

  let duplicate = false;
  await dbx.transaction("rw", writeTables(dbx), async () => {
    const existing = await dbx.vouchers.get(id);
    if (existing) {
      duplicate = true;
      return;
    }
    await addVoucherParts(dbx, voucher, entry);
    await rememberCategories(dbx, voucher);
  });

  if (duplicate) {
    const stored = await readVoucher(dbx, id);
    if (!stored) throw new Error(`Voucher vanished after duplicate post: ${id}`);
    return { ...stored, duplicate: true };
  }
  return { voucher, entry, duplicate: false };
}

async function originalDeltas(dbx: JewelrDb, voucherId: string): Promise<LedgerEntryRow> {
  const row = await dbx.ledger_entries.get(voucherId);
  if (!row) throw new Error(`Original voucher not found: ${voucherId}`);
  return row;
}

/**
 * Reverse a voucher: a REVERSAL voucher plus exactly negated ledger entries
 * dated at the ORIGINAL business date (Q8). Guarded against double reversal.
 */
export async function reverseVoucher(
  originalId: string,
  reason: string,
  options: { reversalId?: string; createdAt?: string } = {},
  dbx: JewelrDb = db,
): Promise<PostedVoucher> {
  if (!reason.trim()) throw new Error("Reversal requires a reason");
  const already = await dbx.vouchers.where("reversesVoucherId").equals(originalId).first();
  if (already) throw new Error(`Voucher already reversed by ${already.id}`);
  const original = await dbx.vouchers.get(originalId);
  if (!original) throw new Error(`Original voucher not found: ${originalId}`);
  if (original.type === "REVERSAL") throw new Error("Cannot reverse a REVERSAL voucher");
  const origEntry = await originalDeltas(dbx, originalId);

  const { voucher, deltas } = buildReversal({
    reversalId: options.reversalId ?? uuid(),
    shopId: SHOP_ID,
    originalVoucherId: originalId,
    originalPartyId: original.partyId,
    originalBusinessDate: original.businessDate,
    originalDeltas: {
      cashPaise: origEntry.cashDeltaPaise,
      goldFineMg: origEntry.goldFineDeltaMg,
      silverFineMg: origEntry.silverFineDeltaMg,
    },
    reason,
    createdAt: options.createdAt ?? nowIso(),
  });
  const entry = entryFromDeltas(voucher, deltas);
  await dbx.transaction("rw", writeTables(dbx), async () => {
    await addVoucherParts(dbx, voucher, entry);
    // Reversed trade returns to (or leaves) the shelf.
    await negateTradeStock(dbx, originalId, voucher.id, voucher.businessDate, voucher.createdAt);
  });
  return { voucher, entry, duplicate: false };
}

/**
 * Correct a voucher: reversal plus replacement in ONE transaction.
 * Both carry the reason — the reversal as reversalReason, the replacement
 * as a notes prefix.
 */
export async function replaceVoucher(
  originalId: string,
  reason: string,
  replacement: PostVoucherInput,
  options: { reversalId?: string; createdAt?: string } = {},
  dbx: JewelrDb = db,
): Promise<{ reversal: PostedVoucher; replacement: PostedVoucher }> {
  if (!reason.trim()) throw new Error("Replacement requires a reason");
  const already = await dbx.vouchers.where("reversesVoucherId").equals(originalId).first();
  if (already) throw new Error(`Voucher already reversed by ${already.id}`);
  const original = await dbx.vouchers.get(originalId);
  if (!original) throw new Error(`Original voucher not found: ${originalId}`);
  if (original.type === "REVERSAL") throw new Error("Cannot reverse a REVERSAL voucher");
  const origEntry = await originalDeltas(dbx, originalId);

  const stamp = options.createdAt ?? nowIso();
  const { voucher: revVoucher, deltas: revDeltas } = buildReversal({
    reversalId: options.reversalId ?? uuid(),
    shopId: SHOP_ID,
    originalVoucherId: originalId,
    originalPartyId: original.partyId,
    originalBusinessDate: original.businessDate,
    originalDeltas: {
      cashPaise: origEntry.cashDeltaPaise,
      goldFineMg: origEntry.goldFineDeltaMg,
      silverFineMg: origEntry.silverFineDeltaMg,
    },
    reason,
    createdAt: stamp,
  });
  const revEntry = entryFromDeltas(revVoucher, revDeltas);

  const repId = replacement.id ?? uuid();
  if (replacement.type === "OPENING") {
    await assertSingleOpening(dbx, replacement.partyId, originalId);
  }
  await assertRoleDirection(dbx, replacement.partyId, replacement.type);
  const repVoucher = buildVoucher({
    id: repId,
    shopId: SHOP_ID,
    createdAt: stamp,
    referenceNumber: replacement.referenceNumber,
    notes: `Corrects ${originalId}: ${reason}${replacement.notes ? ` — ${replacement.notes}` : ""}`,
    partyId: replacement.partyId,
    businessDate: replacement.businessDate,
    type: replacement.type,
    lines: replacement.lines,
    settlement: replacement.settlement,
    conversion: replacement.conversion,
    opening: replacement.opening,
    adjustment: replacement.adjustment,
    misc: replacement.misc,
  });
  const repEntry = entryFromDeltas(repVoucher, voucherDeltas(repVoucher));

  await dbx.transaction("rw", writeTables(dbx), async () => {
    await addVoucherParts(dbx, revVoucher, revEntry);
    await negateTradeStock(dbx, originalId, revVoucher.id, revVoucher.businessDate, revVoucher.createdAt);
    await addVoucherParts(dbx, repVoucher, repEntry);
    await rememberCategories(dbx, repVoucher);
  });
  return {
    reversal: { voucher: revVoucher, entry: revEntry, duplicate: false },
    replacement: { voucher: repVoucher, entry: repEntry, duplicate: false },
  };
}

/** Assemble the domain Voucher from stored rows (no ledger data trusted). */
export async function assembleVoucher(dbx: JewelrDb, id: string): Promise<Voucher | undefined> {
  const row = await dbx.vouchers.get(id);
  if (!row) return undefined;
  const [lines, settlement, conversion, manuals, misc] = await Promise.all([
    dbx.voucher_lines.where("voucherId").equals(id).toArray(),
    dbx.settlements.where("voucherId").equals(id).first(),
    dbx.conversions.where("voucherId").equals(id).first(),
    dbx.manual_deltas.where("voucherId").equals(id).toArray(),
    dbx.misc_charges.where("voucherId").equals(id).toArray(),
  ]);
  const opening = manuals.find((m) => m.kind === "OPENING");
  const adjustment = manuals.find((m) => m.kind === "ADJUSTMENT");
  const voucher: Voucher = {
    id: row.id,
    shopId: row.shopId,
    type: row.type as Voucher["type"],
    partyId: row.partyId,
    businessDate: row.businessDate,
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    reversesVoucherId: row.reversesVoucherId,
    reversalReason: row.reversalReason,
    calculationVersion: row.calculationVersion,
    lines: lines
      .map((l) => ({
        id: l.id,
        voucherId: l.voucherId,
        metalType: l.metalType as SalePurchaseLine["metalType"],
        categoryName: l.categoryName,
        itemCount: l.itemCount,
        physicalMg: l.physicalMg,
        recordedTunchScaled: l.recordedTunchScaled,
        agreedTunchScaled: l.agreedTunchScaled,
        fineMg: l.fineMg,
        rateAmountPaise: l.rateAmountPaise,
        rateUnit: l.rateUnit as SalePurchaseLine["rateUnit"],
        pricingMode: l.pricingMode as SalePurchaseLine["pricingMode"],
        labourPaisePerGram: l.labourPaisePerGram,
        // Legacy v1 rows stored per-gram rates; read them as per-kg (×1000).
        labourMode: (l.labourMode ?? (l.labourPaisePerGram ? "PER_KG" : undefined)) as SalePurchaseLine["labourMode"],
        labourRatePaise:
          l.labourRatePaise ?? (l.labourPaisePerGram !== undefined ? l.labourPaisePerGram * 1000 : undefined),
        labourPaise: l.labourPaise,
        lineCashPaise: l.lineCashPaise,
        notes: l.notes,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    settlement: settlement
      ? {
          cashPaise: settlement.cashPaise,
          goldPhysicalMg: settlement.goldPhysicalMg,
          goldTunchScaled: settlement.goldTunchScaled,
          goldFineMg: settlement.goldFineMg,
          silverPhysicalMg: settlement.silverPhysicalMg,
          silverTunchScaled: settlement.silverTunchScaled,
          silverFineMg: settlement.silverFineMg,
          paymentMode: settlement.paymentMode as SettlementInput["paymentMode"],
        }
      : null,
    conversion: conversion
      ? {
          direction: conversion.direction as ConversionInput["direction"],
          metalType: conversion.metalType as ConversionInput["metalType"],
          // Legacy v1 rows predate the side field; they were party-owes math.
          side: (conversion.side ?? "PARTY_OWES") as ConversionInput["side"],
          fineMg: conversion.fineMg,
          rateAmountPaise: conversion.rateAmountPaise,
          rateUnit: conversion.rateUnit as ConversionInput["rateUnit"],
          cashPaise: conversion.cashPaise,
        }
      : null,
    opening: opening
      ? { cashPaise: opening.cashPaise, goldFineMg: opening.goldFineMg, silverFineMg: opening.silverFineMg }
      : null,
    adjustment: adjustment
      ? {
          cashPaise: adjustment.cashPaise,
          goldFineMg: adjustment.goldFineMg,
          silverFineMg: adjustment.silverFineMg,
        }
      : null,
    misc: misc
      .map((m) => ({ label: m.label, cashPaise: m.cashPaise }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    createdAt: row.createdAt,
  };
  return voucher;
}

/** Assemble voucher plus its stored ledger entry. */
export async function readVoucher(
  dbx: JewelrDb,
  id: string,
): Promise<{ voucher: Voucher; entry: LedgerEntryDelta } | undefined> {
  const voucher = await assembleVoucher(dbx, id);
  if (!voucher) return undefined;
  const entryRow = await dbx.ledger_entries.get(id);
  if (!entryRow) throw new Error(`Ledger entry missing for voucher ${id}`);
  const entry: LedgerEntryDelta = {
    voucherId: entryRow.voucherId,
    partyId: entryRow.partyId,
    businessDate: entryRow.businessDate,
    cashDeltaPaise: entryRow.cashDeltaPaise,
    goldFineDeltaMg: entryRow.goldFineDeltaMg,
    silverFineDeltaMg: entryRow.silverFineDeltaMg,
    description: entryRow.description,
  };
  return { voucher, entry };
}

export async function getVoucher(
  id: string,
  dbx: JewelrDb = db,
): Promise<{ voucher: Voucher; entry: LedgerEntryDelta } | undefined> {
  return readVoucher(dbx, id);
}

/**
 * Recompute a voucher's ledger entry from stored parts through the domain
 * engine — trusting no stored deltas. REVERSAL entries re-derive from the
 * recomputed original (also asserting the Q8 original-date rule).
 */
export async function recomputeEntry(dbx: JewelrDb, id: string): Promise<LedgerEntryDelta> {
  const voucher = await assembleVoucher(dbx, id);
  if (!voucher) throw new Error(`Voucher not found: ${id}`);
  if (voucher.type === "REVERSAL") {
    const origId = voucher.reversesVoucherId;
    if (!origId) throw new Error(`REVERSAL without target: ${id}`);
    const orig = await recomputeEntry(dbx, origId);
    if (voucher.businessDate !== orig.businessDate) {
      throw new Error(`REVERSAL ${id} misdated: ${voucher.businessDate} vs original ${orig.businessDate}`);
    }
    const neg = negateDeltas({
      cashPaise: orig.cashDeltaPaise,
      goldFineMg: orig.goldFineDeltaMg,
      silverFineMg: orig.silverFineDeltaMg,
    });
    return {
      voucherId: id,
      partyId: voucher.partyId,
      businessDate: voucher.businessDate,
      cashDeltaPaise: neg.cashPaise,
      goldFineDeltaMg: neg.goldFineMg,
      silverFineDeltaMg: neg.silverFineMg,
      description: describeVoucher(voucher),
    };
  }
  return entryFromDeltas(voucher, voucherDeltas(voucher));
}

export interface VoucherFilter {
  partyId?: string;
  types?: VoucherType[];
  from?: string;
  to?: string;
}

/** Voucher headers for lists/summary, newest business date first. */
export async function listVouchers(filter: VoucherFilter = {}, dbx: JewelrDb = db): Promise<VoucherRow[]> {
  let rows = filter.partyId
    ? await dbx.vouchers.where("partyId").equals(filter.partyId).toArray()
    : await dbx.vouchers.toArray();
  if (filter.types && filter.types.length > 0) {
    const set = new Set(filter.types);
    rows = rows.filter((r) => set.has(r.type as VoucherType));
  }
  if (filter.from) rows = rows.filter((r) => r.businessDate >= (filter.from as string));
  if (filter.to) rows = rows.filter((r) => r.businessDate <= (filter.to as string));
  return rows.sort((a, b) =>
    a.businessDate === b.businessDate
      ? a.createdAt.localeCompare(b.createdAt)
      : b.businessDate.localeCompare(a.businessDate),
  );
}
