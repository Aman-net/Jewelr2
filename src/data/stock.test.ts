import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { uuid } from "../lib/uuid.ts";
import { createParty } from "./parties.ts";
import { postVoucher, replaceVoucher, reverseVoucher } from "./vouchers.ts";
import { exportBackup, restoreIntoEmpty } from "./backup.ts";
import {
  adjustStock,
  aggregateStock,
  checkShortSale,
  getItemCfg,
  getStock,
  getStockMoves,
  isLowStock,
  recomputeTradeStock,
  seedStock,
  setItemCfg,
} from "./stock.ts";

let tdb: JewelrDb;
let customer: string;
let supplier: string;
beforeEach(async () => {
  tdb = createTestDb(`test-stock-${uuid()}`);
  await clearDb(tdb);
  customer = (await createParty({ name: "Cust", isCustomer: true, isSupplier: false }, tdb)).party.id;
  supplier = (await createParty({ name: "Supp", isCustomer: false, isSupplier: true }, tdb)).party.id;
});

const payalLine = {
  metalType: "SILVER" as const,
  categoryName: "Payal",
  itemCount: 4,
  physicalMg: 100_000,
  agreedTunchScaled: 8000,
  pricingMode: "METAL_OPEN" as const,
};

describe("shop stock", () => {
  it("purchase adds, sale subtracts physical + pcs + fine", async () => {
    await postVoucher(
      { type: "PURCHASE", partyId: supplier, businessDate: "2026-01-05", lines: [payalLine] },
      tdb,
    );
    await postVoucher(
      { type: "SALE", partyId: customer, businessDate: "2026-01-10", lines: [{ ...payalLine, itemCount: 1, physicalMg: 25_000 }] },
      tdb,
    );
    const stock = await getStock(tdb);
    expect(stock).toHaveLength(1);
    expect(stock[0]).toMatchObject({ metal: "SILVER", name: "Payal", physicalMg: 75_000, pcs: 3, fineMg: 60_000 });
  });

  it("lines without a count leave pcs unknown, not zero", async () => {
    await postVoucher(
      {
        type: "PURCHASE",
        partyId: supplier,
        businessDate: "2026-01-05",
        lines: [{ metalType: "GOLD", categoryName: "Biscuit", physicalMg: 10_000, agreedTunchScaled: 10_000, pricingMode: "METAL_OPEN" }],
      },
      tdb,
    );
    const stock = await getStock(tdb);
    expect(stock[0]).toMatchObject({ physicalMg: 10_000, pcs: null, fineMg: 10_000 });
  });

  it("reversal returns trade to the shelf; correction nets correctly", async () => {
    const sale = await postVoucher(
      { type: "SALE", partyId: customer, businessDate: "2026-01-10", lines: [payalLine] },
      tdb,
    );
    expect((await getStock(tdb))[0]?.physicalMg).toBe(-100_000);
    await reverseVoucher(sale.voucher.id, "wrong weight", {}, tdb);
    expect((await getStock(tdb))[0]?.physicalMg).toBe(0);

    const sale2 = await postVoucher(
      { type: "SALE", partyId: customer, businessDate: "2026-01-11", lines: [payalLine] },
      tdb,
    );
    await replaceVoucher(
      sale2.voucher.id,
      "half weight",
      {
        type: "SALE",
        partyId: customer,
        businessDate: "2026-01-11",
        lines: [{ ...payalLine, itemCount: 2, physicalMg: 50_000 }],
      },
      {},
      tdb,
    );
    const stock = await getStock(tdb);
    expect(stock[0]).toMatchObject({ physicalMg: -50_000, pcs: -2, fineMg: -40_000 });
  });

  it("seed and adjust carry reasons and read back chronological", async () => {
    await seedStock(
      [{ metal: "SILVER", name: "Payal", physicalMg: 500_000, pcs: 10, tunchScaled: 8000 }],
      "2026-01-01",
      "Opening count",
      tdb,
    );
    await adjustStock(
      { metal: "SILVER", name: "payal", physicalDeltaMg: -5_000, tunchScaled: 8000, businessDate: "2026-01-03", reason: "Damage" },
      tdb,
    );
    const moves = await getStockMoves("SILVER", "PAYAL", tdb);
    expect(moves.map((m) => m.reason)).toEqual(["Opening count", "Damage"]);
    expect(moves.map((m) => m.physicalDeltaMg)).toEqual([500_000, -5_000]);
    expect((await getStock(tdb))[0]).toMatchObject({ name: "payal", physicalMg: 495_000 });
  });

  it("stored trade rows always match a recompute (reversal-aware)", async () => {
    const sale = await postVoucher(
      { type: "SALE", partyId: customer, businessDate: "2026-01-10", lines: [payalLine] },
      tdb,
    );
    await reverseVoucher(sale.voucher.id, "x", {}, tdb);
    await postVoucher(
      { type: "PURCHASE", partyId: supplier, businessDate: "2026-01-12", lines: [payalLine] },
      tdb,
    );
    const stored = (await tdb.stock_entries.toArray())
      .filter((r) => r.voucherId)
      .map(({ id, createdAt, ...rest }) => rest)
      .sort((a, b) => `${a.voucherId}${a.physicalDeltaMg}`.localeCompare(`${b.voucherId}${b.physicalDeltaMg}`));
    const expected = (await recomputeTradeStock(tdb)).sort((a, b) =>
      `${a.voucherId}${a.physicalDeltaMg}`.localeCompare(`${b.voucherId}${b.physicalDeltaMg}`),
    );
    // Reversal negation rows have no voucher-line source; compare live-voucher rows only.
    const liveIds = new Set(expected.map((e) => e.voucherId));
    expect(stored.filter((r) => liveIds.has(r.voucherId))).toEqual(expected);
  });

  it("flags only the short lines, never blocks", async () => {
    await seedStock(
      [{ metal: "SILVER", name: "Payal", physicalMg: 30_000, tunchScaled: 8000 }],
      "2026-01-01",
      undefined,
      tdb,
    );
    const stock = await getStock(tdb);
    const shorts = checkShortSale(
      [
        { metalType: "SILVER", categoryName: "Payal", physicalMg: 100_000 },
        { metalType: "SILVER", categoryName: "Bichiya", physicalMg: 10_000 },
        { metalType: "GOLD", categoryName: "Biscuit", physicalMg: 1 },
      ],
      stock,
    );
    // Payal short by 70g; Bichiya/Gold have zero stock but need > 0 — all three flag.
    expect(shorts.map((s) => s.name)).toEqual(["Payal", "Bichiya", "Biscuit"]);
    expect(shorts[0]).toMatchObject({ needMg: 100_000, haveMg: 30_000 });
    expect(checkShortSale([{ metalType: "SILVER", categoryName: "Payal", physicalMg: 30_000 }], stock)).toEqual([]);
  });

  it("item config round-trips and validates", async () => {
    expect(await getItemCfg("SILVER", "Payal", tdb)).toEqual({});
    await setItemCfg("SILVER", "Payal", { defaultTunchScaled: 8000, lowMg: 50_000, lowPcs: 2 }, tdb);
    expect(await getItemCfg("SILVER", "payal", tdb)).toEqual({ defaultTunchScaled: 8000, lowMg: 50_000, lowPcs: 2 });
    expect(isLowStock({ metal: "SILVER", name: "Payal", physicalMg: 40_000, pcs: 5, fineMg: 0 }, await getItemCfg("SILVER", "Payal", tdb))).toBe(true);
    expect(isLowStock({ metal: "SILVER", name: "Payal", physicalMg: 60_000, pcs: 5, fineMg: 0 }, await getItemCfg("SILVER", "Payal", tdb))).toBe(false);
    await expect(setItemCfg("SILVER", "Payal", { defaultTunchScaled: 10_001 }, tdb)).rejects.toThrow(/tunch/i);
  });

  it("saves selling labour and clears it as a pair", async () => {
    await setItemCfg("SILVER", "Payal", { sellingLabourMode: "PER_PIECE", sellingLabourRatePaise: 5000 }, tdb);
    expect(await getItemCfg("SILVER", "Payal", tdb)).toEqual({ sellingLabourMode: "PER_PIECE", sellingLabourRatePaise: 5000 });
    // Mode and rate are a pair — neither alone is meaningful on a fresh item.
    await expect(setItemCfg("SILVER", "Bichiya", { sellingLabourMode: "PER_KG" }, tdb)).rejects.toThrow(/both/i);
    await expect(setItemCfg("SILVER", "Bichiya", { sellingLabourRatePaise: 100 }, tdb)).rejects.toThrow(/both/i);
    await expect(setItemCfg("SILVER", "Bichiya", { sellingLabourMode: "PER_KG", sellingLabourRatePaise: 0 }, tdb)).rejects.toThrow(/more than zero/i);
    // Clearing both drops the keys and keeps the rest of the config.
    await setItemCfg("SILVER", "Payal", { defaultTunchScaled: 8000 }, tdb);
    await setItemCfg("SILVER", "Payal", { sellingLabourMode: undefined, sellingLabourRatePaise: undefined }, tdb);
    expect(await getItemCfg("SILVER", "Payal", tdb)).toEqual({ defaultTunchScaled: 8000 });
  });

  it("stock movements carry the source line's labour", async () => {
    await postVoucher(
      { type: "PURCHASE", partyId: supplier, businessDate: "2026-01-05", lines: [{ ...payalLine, labourMode: "PER_PIECE", labourRatePaise: 5000 }] },
      tdb,
    );
    await seedStock([{ metal: "SILVER", name: "Payal", physicalMg: 10_000, tunchScaled: 8000 }], "2026-01-02", undefined, tdb);
    const moves = await getStockMoves("SILVER", "Payal", tdb);
    expect(moves.find((m) => m.voucherType === "PURCHASE")).toMatchObject({
      labourMode: "PER_PIECE",
      labourRatePaise: 5000,
      labourPaise: 20_000,
    });
    expect(moves.find((m) => m.reason === "Opening count")?.labourPaise).toBeUndefined();
  });

  it("backup carries stock and restores it", async () => {
    await seedStock(
      [{ metal: "SILVER", name: "Payal", physicalMg: 500_000, tunchScaled: 8000 }],
      "2026-01-01",
      undefined,
      tdb,
    );
    const backup = await exportBackup(tdb);
    expect(backup.tables.stock_entries).toHaveLength(1);
    const fresh = createTestDb(`test-stock-restore-${uuid()}`);
    await restoreIntoEmpty(JSON.parse(JSON.stringify(backup)), fresh);
    expect(await getStock(fresh)).toMatchObject([{ name: "Payal", physicalMg: 500_000 }]);
  });

  it("aggregateStock is readable without a database", () => {
    expect(aggregateStock([])).toEqual([]);
  });
});
