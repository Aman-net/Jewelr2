import { z } from "zod";
import { getAllBalances } from "./ledger.ts";
import { db } from "./db.ts";
import type {
  AppSettingRow,
  AuditEventRow,
  ConversionRow,
  JewelrDb,
  LedgerEntryRow,
  ManualDeltaRow,
  PartyRow,
  SettlementRow,
  VoucherLineRow,
  VoucherRow,
} from "./db.ts";

export const BACKUP_FORMAT = "jewelr2-backup" as const;
export const BACKUP_SCHEMA_VERSION = 1;
export const APP_VERSION = "0.1.0";
export const LAST_BACKUP_KEY = "lastBackupAt";

const rowWithId = z.object({ id: z.string().min(1) }).passthrough();
const settingRow = z.object({ key: z.string().min(1), value: z.string() }).passthrough();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int(),
  appVersion: z.string().min(1),
  exportedAt: z.string().datetime({ offset: true }),
  tables: z.object({
    parties: z.array(rowWithId),
    vouchers: z.array(rowWithId),
    voucher_lines: z.array(rowWithId),
    settlements: z.array(rowWithId),
    conversions: z.array(rowWithId),
    manual_deltas: z.array(rowWithId),
    ledger_entries: z.array(rowWithId),
    audit_events: z.array(rowWithId),
    app_settings: z.array(settingRow),
  }),
});

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  tables: {
    parties: PartyRow[];
    vouchers: VoucherRow[];
    voucher_lines: VoucherLineRow[];
    settlements: SettlementRow[];
    conversions: ConversionRow[];
    manual_deltas: ManualDeltaRow[];
    ledger_entries: LedgerEntryRow[];
    audit_events: AuditEventRow[];
    app_settings: AppSettingRow[];
  };
}

export class BackupError extends Error {}

/** Validate an imported file. Rejects unknown/incompatible versions with a clear error. */
export function parseBackup(json: unknown): BackupFile {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    throw new BackupError(`Invalid backup file: ${parsed.error.issues[0]?.message ?? "schema mismatch"}`);
  }
  if (parsed.data.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new BackupError(
      `Incompatible backup schemaVersion ${parsed.data.schemaVersion} (this app reads ${BACKUP_SCHEMA_VERSION}). ` +
        `Export a fresh backup from the version that created this file.`,
    );
  }
  return parsed.data as unknown as BackupFile;
}

export interface BackupCounts {
  parties: number;
  vouchers: number;
  voucher_lines: number;
  settlements: number;
  conversions: number;
  manual_deltas: number;
  ledger_entries: number;
  audit_events: number;
}

function countsOf(t: BackupFile["tables"]): BackupCounts {
  return {
    parties: t.parties.length,
    vouchers: t.vouchers.length,
    voucher_lines: t.voucher_lines.length,
    settlements: t.settlements.length,
    conversions: t.conversions.length,
    manual_deltas: t.manual_deltas.length,
    ledger_entries: t.ledger_entries.length,
    audit_events: t.audit_events.length,
  };
}

/** Preview entity counts (and party names) before the user confirms a restore. */
export function previewBackup(json: unknown): { counts: BackupCounts; partyNames: string[] } {
  const backup = parseBackup(json);
  return {
    counts: countsOf(backup.tables),
    partyNames: (backup.tables.parties as { name?: unknown }[]).map((p) =>
      typeof p.name === "string" && p.name ? p.name : "?",
    ),
  };
}

/** Full versioned JSON export of every table. Stamps lastBackupAt. */
export async function exportBackup(dbx: JewelrDb = db): Promise<BackupFile> {
  const [parties, vouchers, voucher_lines, settlements, conversions, manual_deltas, ledger_entries, audit_events] =
    await Promise.all([
      dbx.parties.toArray(),
      dbx.vouchers.toArray(),
      dbx.voucher_lines.toArray(),
      dbx.settlements.toArray(),
      dbx.conversions.toArray(),
      dbx.manual_deltas.toArray(),
      dbx.ledger_entries.toArray(),
      dbx.audit_events.toArray(),
    ]);
  const exportedAt = new Date().toISOString();
  await dbx.app_settings.put({ key: LAST_BACKUP_KEY, value: exportedAt });
  const settings = await dbx.app_settings.toArray();
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt,
    tables: {
      parties,
      vouchers,
      voucher_lines,
      settlements,
      conversions,
      manual_deltas,
      ledger_entries,
      audit_events,
      app_settings: settings,
    },
  };
}

async function tableCounts(dbx: JewelrDb): Promise<BackupCounts> {
  const [parties, vouchers, voucher_lines, settlements, conversions, manual_deltas, ledger_entries, audit_events] =
    await Promise.all([
      dbx.parties.count(),
      dbx.vouchers.count(),
      dbx.voucher_lines.count(),
      dbx.settlements.count(),
      dbx.conversions.count(),
      dbx.manual_deltas.count(),
      dbx.ledger_entries.count(),
      dbx.audit_events.count(),
    ]);
  return { parties, vouchers, voucher_lines, settlements, conversions, manual_deltas, ledger_entries, audit_events };
}

async function writeBackupTables(dbx: JewelrDb, backup: BackupFile): Promise<void> {
  const t = backup.tables;
  await dbx.transaction(
    "rw",
    [
      dbx.parties,
      dbx.vouchers,
      dbx.voucher_lines,
      dbx.settlements,
      dbx.conversions,
      dbx.manual_deltas,
      dbx.ledger_entries,
      dbx.audit_events,
      dbx.app_settings,
    ],
    async () => {
      if (t.parties.length > 0) await dbx.parties.bulkAdd(t.parties);
      if (t.vouchers.length > 0) await dbx.vouchers.bulkAdd(t.vouchers);
      if (t.voucher_lines.length > 0) await dbx.voucher_lines.bulkAdd(t.voucher_lines);
      if (t.settlements.length > 0) await dbx.settlements.bulkAdd(t.settlements);
      if (t.conversions.length > 0) await dbx.conversions.bulkAdd(t.conversions);
      if (t.manual_deltas.length > 0) await dbx.manual_deltas.bulkAdd(t.manual_deltas);
      if (t.ledger_entries.length > 0) await dbx.ledger_entries.bulkAdd(t.ledger_entries);
      if (t.audit_events.length > 0) await dbx.audit_events.bulkAdd(t.audit_events);
      if (t.app_settings.length > 0) await dbx.app_settings.bulkPut(t.app_settings);
    },
  );
}

/**
 * Integrity check: per-party balances recomputed from the LIVE ledger must
 * equal the balances summed from the BACKUP's own ledger entries, and live
 * counts must equal backup counts. Runs automatically after restore.
 */
export async function checkIntegrity(
  dbx: JewelrDb,
  backup: BackupFile,
): Promise<{ counts: BackupCounts; balances: Record<string, { cashPaise: number; goldFineMg: number; silverFineMg: number }> }> {
  const expectedCounts = countsOf(backup.tables);
  const expectedBalances: Record<string, { cashPaise: number; goldFineMg: number; silverFineMg: number }> = {};
  for (const r of backup.tables.ledger_entries) {
    const prev = expectedBalances[r.partyId] ?? { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
    expectedBalances[r.partyId] = {
      cashPaise: prev.cashPaise + r.cashDeltaPaise,
      goldFineMg: prev.goldFineMg + r.goldFineDeltaMg,
      silverFineMg: prev.silverFineMg + r.silverFineDeltaMg,
    };
  }
  const live = await tableCounts(dbx);
  const counts: BackupCounts = {
    parties: live.parties,
    vouchers: live.vouchers,
    voucher_lines: live.voucher_lines,
    settlements: live.settlements,
    conversions: live.conversions,
    manual_deltas: live.manual_deltas,
    ledger_entries: live.ledger_entries,
    audit_events: live.audit_events,
  };
  if (JSON.stringify(counts) !== JSON.stringify(expectedCounts)) {
    throw new BackupError(
      `Integrity check failed: counts differ (expected ${JSON.stringify(expectedCounts)}, got ${JSON.stringify(counts)})`,
    );
  }
  const balances = await getAllBalances(dbx);
  if (JSON.stringify(balances) !== JSON.stringify(expectedBalances)) {
    throw new BackupError("Integrity check failed: balances differ after restore");
  }
  return { counts, balances };
}

/**
 * Restore into an EMPTY database only. Throws when any table is non-empty —
 * use replaceWithBackup() (explicit, with automatic pre-restore export) instead.
 */
export async function restoreIntoEmpty(json: unknown, dbx: JewelrDb = db): Promise<BackupCounts> {
  const backup = parseBackup(json);
  const existing = await tableCounts(dbx);
  const nonEmpty = Object.values(existing).some((c) => c > 0);
  if (nonEmpty) {
    throw new BackupError("Database is not empty. Restore-into-empty refused; use replaceWithBackup() to replace existing data.");
  }
  await writeBackupTables(dbx, backup);
  await checkIntegrity(dbx, backup);
  return countsOf(backup.tables);
}

/**
 * Replace ALL existing data with a backup. Returns an automatic pre-restore
 * export first, so nothing is silently lost. Caller must confirm twice in UI.
 */
export async function replaceWithBackup(
  json: unknown,
  dbx: JewelrDb = db,
): Promise<{ preRestore: BackupFile; counts: BackupCounts }> {
  const backup = parseBackup(json);
  const preRestore = await exportBackup(dbx);
  await dbx.transaction(
    "rw",
    [
      dbx.parties,
      dbx.vouchers,
      dbx.voucher_lines,
      dbx.settlements,
      dbx.conversions,
      dbx.manual_deltas,
      dbx.ledger_entries,
      dbx.audit_events,
      dbx.app_settings,
    ],
    async () => {
      await Promise.all(
        [
          dbx.parties,
          dbx.vouchers,
          dbx.voucher_lines,
          dbx.settlements,
          dbx.conversions,
          dbx.manual_deltas,
          dbx.ledger_entries,
          dbx.audit_events,
          dbx.app_settings,
        ].map((t) => t.clear()),
      );
    },
  );
  await writeBackupTables(dbx, backup);
  await checkIntegrity(dbx, backup);
  return { preRestore, counts: countsOf(backup.tables) };
}

export async function getLastBackupAt(dbx: JewelrDb = db): Promise<string | undefined> {
  return (await dbx.app_settings.get(LAST_BACKUP_KEY))?.value;
}
