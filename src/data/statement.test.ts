import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { uuid } from "../lib/uuid.ts";
import { createParty } from "./parties.ts";
import { postVoucher, reverseVoucher } from "./vouchers.ts";
import { buildStatement, firstOfMonth, getStatement, prevDay } from "./statement.ts";

let tdb: JewelrDb;
let partyId: string;
beforeEach(async () => {
  tdb = createTestDb(`test-statement-${uuid()}`);
  await clearDb(tdb);
  partyId = (await createParty({ name: "Sharma", isCustomer: true, isSupplier: false }, tdb)).party.id;
});

describe("statement", () => {
  it("prevDay / firstOfMonth handle month boundaries", () => {
    expect(prevDay("2026-01-10")).toBe("2026-01-09");
    expect(prevDay("2026-01-01")).toBe("2025-12-31");
    expect(firstOfMonth("2026-01-10")).toBe("2026-01-01");
  });

  it("builds opening + rows + closing without netting columns", async () => {
    await postVoucher(
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-05",
        lines: [
          {
            metalType: "GOLD",
            categoryName: "Biscuit",
            physicalMg: 10_000,
            agreedTunchScaled: 10_000,
            pricingMode: "METAL_OPEN",
          },
        ],
      },
      tdb,
    );
    await postVoucher(
      { type: "RECEIPT", partyId, businessDate: "2026-01-12", settlement: { cashPaise: 1_000 } },
      tdb,
    );
    const st = await getStatement(partyId, "2026-01-10", "2026-01-31", tdb);
    // Opening carries the pre-range metal due; the period only moves cash.
    expect(st.opening).toEqual({ cashPaise: 0, goldFineMg: 10_000, silverFineMg: 0 });
    expect(st.rows).toHaveLength(1);
    expect(st.rows[0]).toMatchObject({ cashDeltaPaise: -1_000, goldFineDeltaMg: 0 });
    expect(st.rows[0]?.balCashPaise).toBe(-1_000);
    expect(st.rows[0]?.balGoldFineMg).toBe(10_000);
    expect(st.totals).toEqual({ cashPaise: -1_000, goldFineMg: 0, silverFineMg: 0 });
    expect(st.closing).toEqual({ cashPaise: -1_000, goldFineMg: 10_000, silverFineMg: 0 });
  });

  it("empty range still shows opening and closing (never net-zero)", async () => {
    await postVoucher(
      { type: "RECEIPT", partyId, businessDate: "2026-01-05", settlement: { cashPaise: 2_000 } },
      tdb,
    );
    const st = await getStatement(partyId, "2026-01-10", "2026-01-31", tdb);
    expect(st.rows).toHaveLength(0);
    expect(st.totals).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
    expect(st.closing).toEqual(st.opening);
    expect(st.opening).toEqual({ cashPaise: -2_000, goldFineMg: 0, silverFineMg: 0 });
  });

  it("reversals collapse into their original: one paper row, net effect", async () => {
    const sale = await postVoucher(
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-12",
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
      tdb,
    );
    await reverseVoucher(sale.voucher.id, "wrong weight", {}, tdb);
    const st = await getStatement(partyId, "2026-01-01", "2026-01-31", tdb);
    expect(st.rows).toHaveLength(1);
    expect(st.rows[0]).toMatchObject({
      serial: 1,
      cashDeltaPaise: 0,
      silverFineDeltaMg: 0,
      pair: { otherSerial: 2, reason: "wrong weight" },
    });
    expect(st.totals).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
    expect(st.closing).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
    // Gross volumes still record both legs (Khatabook-style in/out).
    expect(st.grossIn).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 80_000 });
    expect(st.grossOut).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: -80_000 });
  });

  it("tracks serials, gross volumes, and metal presence", async () => {
    await postVoucher(
      { type: "RECEIPT", partyId, businessDate: "2026-01-12", settlement: { cashPaise: 1_000 } },
      tdb,
    );
    await postVoucher(
      { type: "PAYMENT", partyId, businessDate: "2026-01-13", settlement: { cashPaise: 400 } },
      tdb,
    );
    const st = await getStatement(partyId, "2026-01-01", "2026-01-31", tdb);
    expect(st.rows.map((r) => r.serial)).toEqual([1, 2]);
    expect(st.grossIn).toEqual({ cashPaise: 400, goldFineMg: 0, silverFineMg: 0 });
    expect(st.grossOut).toEqual({ cashPaise: -1_000, goldFineMg: 0, silverFineMg: 0 });
    expect(st.metals).toEqual({ gold: false, silver: false });
  });

  it("rejects inverted ranges; whole-khata mode starts from zero", async () => {
    await expect(getStatement(partyId, "2026-02-01", "2026-01-01", tdb)).rejects.toThrow(/after end/);
    const st = await getStatement(partyId, "", "2026-01-31", tdb);
    expect(st.opening).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
    expect(buildStatement(partyId, "", "", { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 }, []).rows).toEqual([]);
  });
});
