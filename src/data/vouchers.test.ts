import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { uuid } from "../lib/uuid.ts";
import { createParty } from "./parties.ts";
import {
  getVoucher,
  postVoucher,
  replaceVoucher,
  reverseVoucher,
} from "./vouchers.ts";

let tdb: JewelrDb;
let partyId: string;
beforeEach(async () => {
  tdb = createTestDb(`test-vouchers-${uuid()}`);
  await clearDb(tdb);
  partyId = (await createParty({ name: "P1", isCustomer: true, isSupplier: true }, tdb)).party.id;
});

const SALE_OPEN = {
  type: "SALE" as const,
  businessDate: "2026-01-10",
  lines: [
    {
      metalType: "SILVER" as const,
      categoryName: "Payal",
      physicalMg: 100_000,
      recordedTunchScaled: 7950,
      agreedTunchScaled: 8000,
      pricingMode: "METAL_OPEN" as const,
    },
  ],
};

describe("postVoucher", () => {
  it("posts sale/purchase/receipt/payment/conversion/opening/adjustment with exact deltas", async () => {
    const sale = await postVoucher({ ...SALE_OPEN, partyId }, tdb);
    expect(sale.entry).toMatchObject({ cashDeltaPaise: 0, goldFineDeltaMg: 0, silverFineDeltaMg: 80_000 });

    const purchase = await postVoucher(
      {
        type: "PURCHASE",
        partyId,
        businessDate: "2026-01-10",
        lines: [
          {
            metalType: "GOLD",
            categoryName: "Old gold",
            physicalMg: 20_000,
            agreedTunchScaled: 9000,
            pricingMode: "METAL_OPEN",
          },
        ],
      },
      tdb,
    );
    expect(purchase.entry).toMatchObject({ cashDeltaPaise: 0, goldFineDeltaMg: -18_000, silverFineDeltaMg: 0 });

    const receipt = await postVoucher(
      { type: "RECEIPT", partyId, businessDate: "2026-01-11", settlement: { cashPaise: 500_000 } },
      tdb,
    );
    expect(receipt.entry.cashDeltaPaise).toBe(-500_000);

    const payment = await postVoucher(
      { type: "PAYMENT", partyId, businessDate: "2026-01-11", settlement: { cashPaise: 200_000 } },
      tdb,
    );
    expect(payment.entry.cashDeltaPaise).toBe(200_000);

    const conversion = await postVoucher(
      {
        type: "CONVERSION",
        partyId,
        businessDate: "2026-01-12",
        conversion: {
          direction: "METAL_TO_CASH",
          metalType: "GOLD",
          fineMg: 10_000,
          rateAmountPaise: 12_000_000,
          rateUnit: "GOLD_PER_10G",
        },
      },
      tdb,
    );
    expect(conversion.entry).toMatchObject({ cashDeltaPaise: 12_000_000, goldFineDeltaMg: -10_000 });

    const opening = await postVoucher(
      {
        type: "OPENING",
        partyId,
        businessDate: "2026-01-01",
        opening: { cashPaise: 100_000, goldFineMg: 5_000, silverFineMg: 0 },
      },
      tdb,
    );
    expect(opening.entry).toMatchObject({ cashDeltaPaise: 100_000, goldFineDeltaMg: 5_000 });

    const adj = await postVoucher(
      {
        type: "ADJUSTMENT",
        partyId,
        businessDate: "2026-01-13",
        adjustment: { cashPaise: -50, goldFineMg: 0, silverFineMg: 0 },
      },
      tdb,
    );
    expect(adj.entry.cashDeltaPaise).toBe(-50);
  });

  it("allows only one live opening per party, but a reversed one can be replaced", async () => {
    const first = await postVoucher(
      {
        type: "OPENING",
        partyId,
        businessDate: "2026-01-01",
        opening: { cashPaise: 100_000, goldFineMg: 0, silverFineMg: 0 },
      },
      tdb,
    );
    await expect(
      postVoucher(
        {
          type: "OPENING",
          partyId,
          businessDate: "2026-01-02",
          opening: { cashPaise: 50_000, goldFineMg: 0, silverFineMg: 0 },
        },
        tdb,
      ),
    ).rejects.toThrow(/already has an opening/);
    expect(await tdb.vouchers.where("partyId").equals(partyId).count()).toBe(1);

    await reverseVoucher(first.voucher.id, "wrong amount", {}, tdb);
    const second = await postVoucher(
      {
        type: "OPENING",
        partyId,
        businessDate: "2026-01-01",
        opening: { cashPaise: 120_000, goldFineMg: 0, silverFineMg: 0 },
      },
      tdb,
    );
    expect(second.entry.cashDeltaPaise).toBe(120_000);
  });

  it("is idempotent: reposting an id is a no-op returning the stored voucher", async () => {
    const id = uuid();
    const first = await postVoucher({ ...SALE_OPEN, id, partyId }, tdb);
    expect(first.duplicate).toBe(false);
    const second = await postVoucher({ ...SALE_OPEN, id, partyId }, tdb);
    expect(second.duplicate).toBe(true);
    expect(second.voucher).toEqual(first.voucher);
    expect(await tdb.vouchers.count()).toBe(1);
    expect(await tdb.ledger_entries.count()).toBe(1);
    expect(await tdb.voucher_lines.count()).toBe(1);
  });

  it("writes nothing when validation fails", async () => {
    await expect(postVoucher({ type: "SALE", partyId, businessDate: "2026-01-10" }, tdb)).rejects.toThrow();
    await expect(
      postVoucher(
        {
          type: "SALE",
          partyId,
          businessDate: "2026-01-10",
          lines: [
            {
              metalType: "GOLD",
              categoryName: "A",
              physicalMg: 1000,
              agreedTunchScaled: 10_000,
              pricingMode: "CASH_AT_RATE",
              rateAmountPaise: 1_000,
              rateUnit: "SILVER_PER_KG",
            },
          ],
        },
        tdb,
      ),
    ).rejects.toThrow(/Rate unit/);
    for (const t of [tdb.vouchers, tdb.voucher_lines, tdb.ledger_entries]) {
      expect(await t.count()).toBe(0);
    }
  });

  it("is atomic: a mid-write failure leaves no partial rows", async () => {
    const id = uuid();
    // Collide with the line id this post would write, forcing bulkAdd to fail mid-transaction.
    await tdb.voucher_lines.add({
      id: `${id}#L0`,
      voucherId: "unrelated",
      metalType: "SILVER",
      categoryName: "X",
      physicalMg: 1,
      agreedTunchScaled: 8000,
      fineMg: 1,
      pricingMode: "METAL_OPEN",
      labourPaise: 0,
      lineCashPaise: 0,
    });
    await expect(postVoucher({ ...SALE_OPEN, id, partyId }, tdb)).rejects.toThrow();
    expect(await tdb.vouchers.get(id)).toBeUndefined();
    expect(await tdb.ledger_entries.get(id)).toBeUndefined();
  });

  it("keeps stored snapshots immune to later rate changes", async () => {
    const line = {
      metalType: "GOLD" as const,
      categoryName: "Biscuit",
      physicalMg: 10_000,
      agreedTunchScaled: 10_000,
      pricingMode: "CASH_AT_RATE" as const,
      rateAmountPaise: 10_000_000,
      rateUnit: "GOLD_PER_10G" as const,
    };
    const first = await postVoucher({ type: "SALE", partyId, businessDate: "2026-01-10", lines: [line] }, tdb);
    await postVoucher(
      { type: "SALE", partyId, businessDate: "2026-01-11", lines: [{ ...line, rateAmountPaise: 12_000_000 }] },
      tdb,
    );
    const reread = await getVoucher(first.voucher.id, tdb);
    expect(reread?.voucher.lines[0]?.lineCashPaise).toBe(10_000_000);
    expect(reread?.entry.cashDeltaPaise).toBe(10_000_000);
  });
});

describe("reverseVoucher / replaceVoucher", () => {
  it("reverses with exactly negated deltas at the original date", async () => {
    const sale = await postVoucher({ ...SALE_OPEN, partyId, businessDate: "2026-01-10" }, tdb);
    const rev = await reverseVoucher(sale.voucher.id, "wrong tunch", {}, tdb);
    expect(rev.voucher.type).toBe("REVERSAL");
    expect(rev.voucher.reversesVoucherId).toBe(sale.voucher.id);
    expect(rev.entry).toMatchObject({
      businessDate: "2026-01-10",
      cashDeltaPaise: 0,
      goldFineDeltaMg: 0,
      silverFineDeltaMg: -80_000,
    });
  });

  it("guards double reversal, unknown ids, and reversing a reversal", async () => {
    const sale = await postVoucher({ ...SALE_OPEN, partyId }, tdb);
    const rev = await reverseVoucher(sale.voucher.id, "oops", {}, tdb);
    await expect(reverseVoucher(sale.voucher.id, "again", {}, tdb)).rejects.toThrow(/already reversed/);
    await expect(reverseVoucher(rev.voucher.id, "x", {}, tdb)).rejects.toThrow(/Cannot reverse a REVERSAL/);
    await expect(
      reverseVoucher("00000000-0000-4000-8000-000000000000", "x", {}, tdb),
    ).rejects.toThrow(/not found/);
    await expect(reverseVoucher(sale.voucher.id, "  ", {}, tdb)).rejects.toThrow(/reason/);
  });

  it("replaces atomically: reversal plus reason-carrying replacement", async () => {
    const sale = await postVoucher({ ...SALE_OPEN, partyId }, tdb);
    const { reversal, replacement } = await replaceVoucher(
      sale.voucher.id,
      "tunch was 75 not 80",
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-10",
        lines: [
          {
            metalType: "SILVER",
            categoryName: "Payal",
            physicalMg: 100_000,
            agreedTunchScaled: 7500,
            pricingMode: "METAL_OPEN",
          },
        ],
      },
      {},
      tdb,
    );
    expect(reversal.entry.silverFineDeltaMg).toBe(-80_000);
    expect(replacement.entry.silverFineDeltaMg).toBe(75_000);
    expect(replacement.voucher.notes).toContain("tunch was 75 not 80");
    // Net effect: original corrected 80k -> 75k.
    const entries = await tdb.ledger_entries.where("partyId").equals(partyId).toArray();
    const total = entries.reduce((n, e) => n + e.silverFineDeltaMg, 0);
    expect(total).toBe(75_000);
  });
});
