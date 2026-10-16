import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { uuid } from "../lib/uuid.ts";
import { createParty } from "./parties.ts";
import { postVoucher, reverseVoucher } from "./vouchers.ts";
import { getAllDuesSplits, getDuesSplit } from "./dues.ts";

let tdb: JewelrDb;
let partyId: string;
beforeEach(async () => {
  tdb = createTestDb(`test-dues-${uuid()}`);
  await clearDb(tdb);
  partyId = (await createParty({ name: "Both", isCustomer: true, isSupplier: true }, tdb)).party.id;
});

const silverLine = {
  metalType: "SILVER" as const,
  categoryName: "Payal",
  physicalMg: 100_000,
  agreedTunchScaled: 8000,
  pricingMode: "METAL_OPEN" as const,
};

describe("dues split", () => {
  it("sale-dues = SALE minus RECEIPTs; purchase-dues = PURCHASE minus PAYMENTs", async () => {
    await postVoucher(
      { type: "SALE", partyId, businessDate: "2026-01-10", lines: [silverLine] },
      tdb,
    );
    await postVoucher(
      { type: "RECEIPT", partyId, businessDate: "2026-01-11", settlement: { cashPaise: 1_000 } },
      tdb,
    );
    await postVoucher(
      { type: "PURCHASE", partyId, businessDate: "2026-01-12", lines: [silverLine] },
      tdb,
    );
    await postVoucher(
      { type: "PAYMENT", partyId, businessDate: "2026-01-13", settlement: { cashPaise: 500 } },
      tdb,
    );
    const split = await getDuesSplit(partyId, tdb);
    expect(split.sale).toEqual({ cashPaise: -1_000, goldFineMg: 0, silverFineMg: 80_000 });
    expect(split.purchase).toEqual({ cashPaise: 500, goldFineMg: 0, silverFineMg: -80_000 });
    expect(split.combined).toEqual({ cashPaise: -500, goldFineMg: 0, silverFineMg: 0 });
  });

  it("reversals follow their original's bucket; opening/conversion stay combined-only", async () => {
    const sale = await postVoucher(
      { type: "SALE", partyId, businessDate: "2026-01-10", lines: [silverLine] },
      tdb,
    );
    await reverseVoucher(sale.voucher.id, "wrong", {}, tdb);
    await postVoucher(
      {
        type: "OPENING",
        partyId,
        businessDate: "2026-01-01",
        opening: { cashPaise: 5_000, goldFineMg: 0, silverFineMg: 0 },
      },
      tdb,
    );
    await postVoucher(
      {
        type: "CONVERSION",
        partyId,
        businessDate: "2026-01-15",
        conversion: {
          direction: "METAL_TO_CASH",
          metalType: "SILVER",
          side: "PARTY_OWES",
          fineMg: 1_000,
          rateAmountPaise: 80_000,
          rateUnit: "SILVER_PER_KG",
        },
      },
      tdb,
    );
    const split = await getDuesSplit(partyId, tdb);
    expect(split.sale).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
    expect(split.purchase).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
    expect(split.combined).toEqual({ cashPaise: 5_080, goldFineMg: 0, silverFineMg: -1_000 });
  });

  it("aggregates every party in one pass", async () => {
    await postVoucher(
      { type: "SALE", partyId, businessDate: "2026-01-10", lines: [silverLine] },
      tdb,
    );
    const all = await getAllDuesSplits(tdb);
    expect(all[partyId]?.sale).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 80_000 });
  });
});
