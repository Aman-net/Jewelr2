import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  BACKUP_SCHEMA_VERSION,
  BackupError,
  exportBackup,
  getLastBackupAt,
  previewBackup,
  replaceWithBackup,
  restoreIntoEmpty,
} from "./backup.ts";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { getAllBalances } from "./ledger.ts";
import { createParty } from "./parties.ts";
import { postVoucher } from "./vouchers.ts";

let tdb: JewelrDb;
beforeEach(async () => {
  tdb = createTestDb(`test-backup-${crypto.randomUUID()}`);
  await clearDb(tdb);
});

async function seed(dbx: JewelrDb): Promise<{ p1: string; p2: string }> {
  const p1 = (await createParty({ name: "P1", isCustomer: true, isSupplier: false }, dbx)).party.id;
  const p2 = (await createParty({ name: "P2", isCustomer: false, isSupplier: true }, dbx)).party.id;
  await postVoucher(
    {
      type: "SALE",
      partyId: p1,
      businessDate: "2026-01-10",
      lines: [
        {
          metalType: "SILVER",
          categoryName: "Payal",
          physicalMg: 100_000,
          agreedTunchScaled: 8000,
          pricingMode: "METAL_OPEN",
        },
      ],
    },
    dbx,
  );
  await postVoucher(
    { type: "RECEIPT", partyId: p1, businessDate: "2026-01-11", settlement: { cashPaise: 250_000 } },
    dbx,
  );
  await postVoucher(
    {
      type: "OPENING",
      partyId: p2,
      businessDate: "2026-01-01",
      opening: { cashPaise: 10_000, goldFineMg: 2_000, silverFineMg: 0 },
    },
    dbx,
  );
  return { p1, p2 };
}

describe("backup round trip", () => {
  it("exports and restores into a clean database with identical balances", async () => {
    await seed(tdb);
    const backup = await exportBackup(tdb);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(await getLastBackupAt(tdb)).toBe(backup.exportedAt);

    const preview = previewBackup(JSON.parse(JSON.stringify(backup)));
    expect(preview.counts.vouchers).toBe(3);
    expect(preview.partyNames.sort()).toEqual(["P1", "P2"]);

    const fresh = createTestDb(`test-restore-${crypto.randomUUID()}`);
    const counts = await restoreIntoEmpty(JSON.parse(JSON.stringify(backup)), fresh);
    expect(counts.vouchers).toBe(3);
    expect(await getAllBalances(fresh)).toEqual(await getAllBalances(tdb));
    expect(await fresh.voucher_lines.count()).toBe(await tdb.voucher_lines.count());
    expect(await fresh.parties.count()).toBe(2);
  });

  it("rejects invalid and incompatible files with clear errors", async () => {
    await expect(restoreIntoEmpty({ format: "nope" }, tdb)).rejects.toThrow(BackupError);
    await expect(restoreIntoEmpty(null, tdb)).rejects.toThrow(BackupError);
    const backup = await exportBackup(tdb);
    const wrongVersion = { ...backup, schemaVersion: BACKUP_SCHEMA_VERSION + 1 };
    await expect(restoreIntoEmpty(wrongVersion, tdb)).rejects.toThrow(/Incompatible backup/);
  });

  it("refuses restore-into-empty on a non-empty database", async () => {
    await seed(tdb);
    const backup = await exportBackup(tdb);
    await expect(restoreIntoEmpty(backup, tdb)).rejects.toThrow(/not empty/);
  });

  it("replaceWithBackup swaps data with an automatic pre-restore export", async () => {
    await seed(tdb);
    const before = await getAllBalances(tdb);
    const backup = await exportBackup(tdb);

    const other = createTestDb(`test-other-${crypto.randomUUID()}`);
    const { party } = await createParty({ name: "Other", isCustomer: true, isSupplier: false }, other);
    await postVoucher(
      { type: "PAYMENT", partyId: party.id, businessDate: "2026-02-01", settlement: { cashPaise: 999 } },
      other,
    );
    const { preRestore, counts } = await replaceWithBackup(JSON.parse(JSON.stringify(backup)), other);
    expect(counts.vouchers).toBe(3);
    expect(await getAllBalances(other)).toEqual(before);
    // Pre-restore export captured the replaced data.
    expect(preRestore.tables.parties.map((p) => p.name)).toEqual(["Other"]);
  });
});
