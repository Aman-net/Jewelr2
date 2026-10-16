import Dexie, { type Table } from "dexie";

/** Single-shop constant. No UI; reserved for the later multi-shop migration. */
export const SHOP_ID = "shop-local-1" as const;

/** Dexie schema version. Bump with a migration block when tables change. */
export const DB_SCHEMA_VERSION = 4;

export interface PartyRow {
  id: string;
  shopId: string;
  name: string;
  mobile?: string;
  address?: string;
  notes?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VoucherRow {
  id: string;
  shopId: string;
  type: string;
  partyId: string;
  businessDate: string;
  referenceNumber?: string;
  notes?: string;
  reversesVoucherId?: string;
  reversalReason?: string;
  calculationVersion: string;
  createdAt: string;
}

export interface VoucherLineRow {
  id: string;
  voucherId: string;
  metalType: string;
  categoryName: string;
  itemCount?: number;
  physicalMg: number;
  recordedTunchScaled?: number;
  agreedTunchScaled: number;
  fineMg: number;
  rateAmountPaise?: number;
  rateUnit?: string;
  pricingMode: string;
  labourPaisePerGram?: number;
  /** Owner-confirmed 2026-10-15: PER_PIECE | PER_KG. Legacy v1 rows carry per-gram rates. */
  labourMode?: string;
  labourRatePaise?: number;
  labourPaise: number;
  lineCashPaise: number;
  notes?: string;
}

export interface SettlementRow {
  id: string;
  voucherId: string;
  cashPaise?: number;
  goldPhysicalMg?: number;
  goldTunchScaled?: number;
  goldFineMg: number;
  silverPhysicalMg?: number;
  silverTunchScaled?: number;
  silverFineMg: number;
  paymentMode?: string;
}

export interface ConversionRow {
  id: string;
  voucherId: string;
  direction: string;
  metalType: string;
  /** Owner-confirmed 2026-10-15; legacy rows (v1) predate it. */
  side?: string;
  fineMg: number;
  rateAmountPaise: number;
  rateUnit: string;
  cashPaise: number;
}

/** Voucher-level extra charges (SALE/PURCHASE). */
export interface MiscChargeRow {
  id: string;
  voucherId: string;
  label: string;
  cashPaise: number;
}

/** Shop stock movements. Trade rows link a voucher; seed/adjust rows stand alone with a reason. */
export interface StockEntryRow {
  id: string;
  voucherId: string | null;
  metal: string;
  itemName: string;
  physicalDeltaMg: number;
  pcsDelta: number;
  /** False when the movement carries no piece count (pieces are optional). */
  hasPcs: boolean;
  fineDeltaMg: number;
  businessDate: string;
  reason?: string;
  createdAt: string;
}

/** Info-only log of generated bills: period + when (+channel). Never reopened — statements stay live. */
export interface GeneratedBillRow {
  id: string;
  partyId: string;
  fromDate: string;
  toDate: string;
  statementNo: string;
  channel: "PDF" | "PRINT";
  createdAt: string;
}

/** Explicit manual deltas for OPENING and ADJUSTMENT vouchers. */
export interface ManualDeltaRow {
  id: string;
  voucherId: string;
  kind: "OPENING" | "ADJUSTMENT";
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
}

/** One entry per voucher; id === voucherId for stable rebuild comparison. */
export interface LedgerEntryRow {
  id: string;
  voucherId: string;
  partyId: string;
  businessDate: string;
  cashDeltaPaise: number;
  goldFineDeltaMg: number;
  silverFineDeltaMg: number;
  description: string;
  createdAt: string;
}

export interface AuditEventRow {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
  timestamp: string;
}

export interface AppSettingRow {
  key: string;
  value: string;
}

export class JewelrDb extends Dexie {
  parties!: Table<PartyRow, string>;
  vouchers!: Table<VoucherRow, string>;
  voucher_lines!: Table<VoucherLineRow, string>;
  settlements!: Table<SettlementRow, string>;
  conversions!: Table<ConversionRow, string>;
  manual_deltas!: Table<ManualDeltaRow, string>;
  misc_charges!: Table<MiscChargeRow, string>;
  stock_entries!: Table<StockEntryRow, string>;
  generated_bills!: Table<GeneratedBillRow, string>;
  ledger_entries!: Table<LedgerEntryRow, string>;
  audit_events!: Table<AuditEventRow, string>;
  app_settings!: Table<AppSettingRow, string>;

  constructor(name = "jewelr2") {
    super(name);
    // One flat table per entity; voucher lines in their own table; no nested arrays.
    // v1: base schema. v2: + misc_charges table; conversions.side + lines
    // labourMode/labourRatePaise are schemaless columns (no index change).
    this.version(1).stores({
      parties: "id, shopId, name, mobile, active",
      vouchers: "id, shopId, partyId, businessDate, type, reversesVoucherId",
      voucher_lines: "id, voucherId",
      settlements: "id, voucherId",
      conversions: "id, voucherId",
      manual_deltas: "id, voucherId",
      ledger_entries: "id, voucherId, partyId, businessDate",
      audit_events: "id, entityId, timestamp",
      app_settings: "key",
    });
    this.version(2).stores({
      parties: "id, shopId, name, mobile, active",
      vouchers: "id, shopId, partyId, businessDate, type, reversesVoucherId",
      voucher_lines: "id, voucherId",
      settlements: "id, voucherId",
      conversions: "id, voucherId",
      manual_deltas: "id, voucherId",
      misc_charges: "id, voucherId",
      ledger_entries: "id, voucherId, partyId, businessDate",
      audit_events: "id, entityId, timestamp",
      app_settings: "key",
    });
    // v3: + stock_entries (shop stock ledger; trade rows link vouchers).
    this.version(3).stores({
      parties: "id, shopId, name, mobile, active",
      vouchers: "id, shopId, partyId, businessDate, type, reversesVoucherId",
      voucher_lines: "id, voucherId",
      settlements: "id, voucherId",
      conversions: "id, voucherId",
      manual_deltas: "id, voucherId",
      misc_charges: "id, voucherId",
      stock_entries: "id, voucherId, metal, businessDate",
      ledger_entries: "id, voucherId, partyId, businessDate",
      audit_events: "id, entityId, timestamp",
      app_settings: "key",
    });
    // v4: + generated_bills (info-only bill generation log, per party).
    this.version(4).stores({
      parties: "id, shopId, name, mobile, active",
      vouchers: "id, shopId, partyId, businessDate, type, reversesVoucherId",
      voucher_lines: "id, voucherId",
      settlements: "id, voucherId",
      conversions: "id, voucherId",
      manual_deltas: "id, voucherId",
      misc_charges: "id, voucherId",
      stock_entries: "id, voucherId, metal, businessDate",
      generated_bills: "id, partyId, createdAt",
      ledger_entries: "id, voucherId, partyId, businessDate",
      audit_events: "id, entityId, timestamp",
      app_settings: "key",
    });
  }
}

/** App singleton. Tests use createTestDb() with isolated names instead. */
export const db = new JewelrDb();

export function createTestDb(name: string): JewelrDb {
  return new JewelrDb(name);
}

/** Clear every table. Test helper only. */
export async function clearDb(dbx: JewelrDb): Promise<void> {
  const tables = [
    dbx.parties,
    dbx.vouchers,
    dbx.voucher_lines,
    dbx.settlements,
    dbx.conversions,
    dbx.manual_deltas,
    dbx.misc_charges,
    dbx.stock_entries,
    dbx.generated_bills,
    dbx.ledger_entries,
    dbx.audit_events,
    dbx.app_settings,
  ];
  await dbx.transaction("rw", tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
  });
}
