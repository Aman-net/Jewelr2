import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { getAllBalances, getBalances, getBalancesAsOf, getLedger, rebuildLedger, storedEntriesByVoucher } from "./ledger.ts";
import { createParty } from "./parties.ts";
import { postVoucher, reverseVoucher } from "./vouchers.ts";

let tdb: JewelrDb;
let partyId: string;
beforeEach(async () => {
  tdb = createTestDb(`test-ledger-${crypto.randomUUID()}`);
  await clearDb(tdb);
  partyId = (await createParty({ name: "P1", isCustomer: true, isSupplier: false }, tdb)).party.id;
});

describe("ledger queries", () => {
  it("returns entries chronological with date and type filters", async () => {
    await postVoucher(
      {
        type: "RECEIPT",
        partyId,
        businessDate: "2026-01-12",
        settlement: { cashPaise: 1_000 },
      },
      tdb,
    );
    await postVoucher(
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-10",
        lines: [
          {
            metalType: "SILVER",
            categoryName: "B",
            physicalMg: 100_000,
            agreedTunchScaled: 8000,
            pricingMode: "METAL_OPEN",
          },
        ],
      },
      tdb,
    );
    const all = await getLedger(partyId, {}, tdb);
    expect(all.map((e) => e.businessDate)).toEqual(["2026-01-10", "2026-01-12"]);
    expect(await getLedger(partyId, { from: "2026-01-11" }, tdb)).toHaveLength(1);
    expect(await getLedger(partyId, { to: "2026-01-10" }, tdb)).toHaveLength(1);
    expect(await getLedger(partyId, { types: ["SALE"] }, tdb)).toHaveLength(1);
    expect(await getBalances(partyId, tdb)).toEqual({ cashPaise: -1_000, goldFineMg: 0, silverFineMg: 80_000 });
  });

  it("as-of balances include backdated entries", async () => {
    await postVoucher(
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-10",
        lines: [
          {
            metalType: "SILVER",
            categoryName: "B",
            physicalMg: 100_000,
            agreedTunchScaled: 8000,
            pricingMode: "METAL_OPEN",
          },
        ],
      },
      tdb,
    );
    await postVoucher(
      {
        type: "RECEIPT",
        partyId,
        businessDate: "2026-01-05",
        settlement: { cashPaise: 2_000 },
      },
      tdb,
    );
    expect(await getBalancesAsOf(partyId, "2026-01-07", tdb)).toEqual({
      cashPaise: -2_000,
      goldFineMg: 0,
      silverFineMg: 0,
    });
    expect(await getBalancesAsOf(partyId, "2026-01-10", tdb)).toEqual({
      cashPaise: -2_000,
      goldFineMg: 0,
      silverFineMg: 80_000,
    });
  });

  it("rebuildLedger() equals stored entries, and detects tampering", async () => {
    const sale = await postVoucher(
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-10",
        lines: [
          {
            metalType: "GOLD",
            categoryName: "A",
            physicalMg: 10_000,
            agreedTunchScaled: 10_000,
            pricingMode: "CASH_AT_RATE",
            rateAmountPaise: 10_000_000,
            rateUnit: "GOLD_PER_10G",
          },
        ],
      },
      tdb,
    );
    await reverseVoucher(sale.voucher.id, "test reversal", {}, tdb);
    expect(await rebuildLedger(tdb)).toEqual(await storedEntriesByVoucher(tdb));

    // Tamper with a stored entry: a genuine rebuild must diverge.
    const stored = await tdb.ledger_entries.get(sale.voucher.id);
    await tdb.ledger_entries.put({ ...(stored as NonNullable<typeof stored>), cashDeltaPaise: 1 });
    expect(await rebuildLedger(tdb)).not.toEqual(await storedEntriesByVoucher(tdb));
  });

  it("aggregates all-party balances", async () => {
    const p2 = (await createParty({ name: "P2", isCustomer: true, isSupplier: false }, tdb)).party.id;
    await postVoucher({ type: "RECEIPT", partyId, businessDate: "2026-01-10", settlement: { cashPaise: 1_000 } }, tdb);
    await postVoucher({ type: "PAYMENT", partyId: p2, businessDate: "2026-01-10", settlement: { cashPaise: 500 } }, tdb);
    expect(await getAllBalances(tdb)).toEqual({
      [partyId]: { cashPaise: -1_000, goldFineMg: 0, silverFineMg: 0 },
      [p2]: { cashPaise: 500, goldFineMg: 0, silverFineMg: 0 },
    });
  });
});
