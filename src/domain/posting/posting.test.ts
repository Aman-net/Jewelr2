import { describe, expect, it } from "vitest";
import {
  balancesAsOf,
  buildVoucher,
  negateDeltas,
  sumEntries,
  toLedgerEntry,
  voucherDeltas,
} from "../index.ts";
import type { VoucherInput } from "../index.ts";

const SHOP = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";
const AT = "2026-01-10T10:00:00.000Z";

function base(overrides: Partial<VoucherInput> & { id: string; type: VoucherInput["type"] }): VoucherInput {
  return {
    shopId: SHOP,
    partyId: P1,
    businessDate: "2026-01-10",
    createdAt: AT,
    ...overrides,
  };
}

describe("SALE / PURCHASE posting", () => {
  it("METAL_OPEN sale owes fine metal plus cash labour", () => {
    const v = buildVoucher(
      base({
        id: "33333333-3333-4333-8333-333333333333",
        type: "SALE",
        lines: [
          {
            metalType: "SILVER",
            categoryName: "Payal",
            physicalMg: 100_000,
            recordedTunchScaled: 7950,
            agreedTunchScaled: 8000,
            pricingMode: "METAL_OPEN",
            labourPaisePerGram: 2000,
          },
        ],
      }),
    );
    expect(v.lines[0]?.fineMg).toBe(80_000);
    expect(v.lines[0]?.labourPaise).toBe(200_000);
    expect(voucherDeltas(v)).toEqual({ cashPaise: 200_000, goldFineMg: 0, silverFineMg: 80_000 });
  });

  it("CASH_AT_RATE sale owes cash value plus labour, no metal", () => {
    const v = buildVoucher(
      base({
        id: "44444444-4444-4433-8444-444444444444",
        type: "SALE",
        lines: [
          {
            metalType: "GOLD",
            categoryName: "Biscuit",
            physicalMg: 10_000,
            agreedTunchScaled: 10_000,
            pricingMode: "CASH_AT_RATE",
            rateAmountPaise: 10_000_000,
            rateUnit: "GOLD_PER_10G",
            labourPaisePerGram: 5000,
          },
        ],
      }),
    );
    expect(v.lines[0]?.lineCashPaise).toBe(10_000_000);
    expect(voucherDeltas(v)).toEqual({ cashPaise: 10_050_000, goldFineMg: 0, silverFineMg: 0 });
  });

  it("one voucher can mix CASH_AT_RATE and METAL_OPEN lines (Q1)", () => {
    const v = buildVoucher(
      base({
        id: "55555555-5555-4533-8555-555555555555",
        type: "SALE",
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
          {
            metalType: "SILVER",
            categoryName: "B",
            physicalMg: 100_000,
            agreedTunchScaled: 8000,
            pricingMode: "METAL_OPEN",
          },
        ],
      }),
    );
    expect(voucherDeltas(v)).toEqual({ cashPaise: 10_000_000, goldFineMg: 0, silverFineMg: 80_000 });
  });

  it("PURCHASE mirrors SALE with negative signs; purchases carry no labour (Q5)", () => {
    const v = buildVoucher(
      base({
        id: "66666666-6666-4633-8666-666666666666",
        type: "PURCHASE",
        lines: [
          {
            metalType: "GOLD",
            categoryName: "Old gold",
            physicalMg: 20_000,
            agreedTunchScaled: 9000,
            pricingMode: "METAL_OPEN",
            labourPaisePerGram: 5000,
          },
        ],
      }),
    );
    expect(voucherDeltas(v)).toEqual({ cashPaise: 0, goldFineMg: -18_000, silverFineMg: 0 });
  });

  it("rejects mismatched rate units and missing rates", () => {
    expect(() =>
      buildVoucher(
        base({
          id: "77777777-7777-4733-8777-777777777777",
          type: "SALE",
          lines: [
            {
              metalType: "GOLD",
              categoryName: "A",
              physicalMg: 1000,
              agreedTunchScaled: 10_000,
              pricingMode: "CASH_AT_RATE",
              rateAmountPaise: 10_000_000,
              rateUnit: "SILVER_PER_KG",
            },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      buildVoucher(
        base({
          id: "88888888-8888-4833-8888-888888888888",
          type: "SALE",
        }),
      ),
    ).toThrow();
  });
});

describe("RECEIPT / PAYMENT / CONVERSION / OPENING / ADJUSTMENT", () => {
  it("RECEIPT reduces balances; PAYMENT increases them (Q3: own columns only)", () => {
    const settlement = { cashPaise: 1_000_000, silverPhysicalMg: 50_000, silverTunchScaled: 8000 };
    const r = buildVoucher(
      base({ id: "99999999-9999-4933-8999-999999999999", type: "RECEIPT", settlement }),
    );
    expect(r.settlement?.silverFineMg).toBe(40_000);
    expect(voucherDeltas(r)).toEqual({ cashPaise: -1_000_000, goldFineMg: 0, silverFineMg: -40_000 });
    const p = buildVoucher(
      base({ id: "aaaaaaaa-aaaa-4a33-8aaa-aaaaaaaaaaaa", type: "PAYMENT", settlement }),
    );
    expect(voucherDeltas(p)).toEqual({ cashPaise: 1_000_000, goldFineMg: 0, silverFineMg: 40_000 });
  });

  it("CONVERSION moves fine to cash at the stored rate", () => {
    const v = buildVoucher(
      base({
        id: "bbbbbbbb-bbbb-4b33-8bbb-bbbbbbbbbbbb",
        type: "CONVERSION",
        conversion: {
          direction: "METAL_TO_CASH",
          metalType: "GOLD",
          fineMg: 10_000,
          rateAmountPaise: 12_000_000,
          rateUnit: "GOLD_PER_10G",
        },
      }),
    );
    expect(v.conversion?.cashPaise).toBe(12_000_000);
    expect(voucherDeltas(v)).toEqual({ cashPaise: 12_000_000, goldFineMg: -10_000, silverFineMg: 0 });
  });

  it("OPENING sets starting deltas in fine weight (Q4)", () => {
    const v = buildVoucher(
      base({
        id: "cccccccc-cccc-4c33-8ccc-cccccccccccc",
        type: "OPENING",
        opening: { cashPaise: 500_000, goldFineMg: 20_000, silverFineMg: 0 },
      }),
    );
    expect(voucherDeltas(v)).toEqual({ cashPaise: 500_000, goldFineMg: 20_000, silverFineMg: 0 });
  });

  it("ADJUSTMENT posts an explicit manual delta", () => {
    const v = buildVoucher(
      base({
        id: "dddddddd-dddd-4d33-8ddd-dddddddddddd",
        type: "ADJUSTMENT",
        adjustment: { cashPaise: -500, goldFineMg: 0, silverFineMg: 100 },
      }),
    );
    expect(voucherDeltas(v)).toEqual({ cashPaise: -500, goldFineMg: 0, silverFineMg: 100 });
  });
});

describe("reversal, rate immutability, as-of", () => {
  it("reversal negates exactly", () => {
    const original = { cashPaise: 10_050_000, goldFineMg: 0, silverFineMg: 80_000 };
    expect(negateDeltas(original)).toEqual({ cashPaise: -10_050_000, goldFineMg: 0, silverFineMg: -80_000 });
    expect(sumEntries([
      { cashDeltaPaise: original.cashPaise, goldFineDeltaMg: original.goldFineMg, silverFineDeltaMg: original.silverFineMg },
      { cashDeltaPaise: -original.cashPaise, goldFineDeltaMg: -original.goldFineMg, silverFineDeltaMg: -original.silverFineMg },
    ])).toEqual({ cashPaise: 0, goldFineMg: 0, silverFineMg: 0 });
  });

  it("a later rate change never alters a stored voucher", () => {
    const line = {
      metalType: "GOLD" as const,
      categoryName: "Biscuit",
      physicalMg: 10_000,
      agreedTunchScaled: 10_000,
      pricingMode: "CASH_AT_RATE" as const,
      rateAmountPaise: 10_000_000,
      rateUnit: "GOLD_PER_10G" as const,
    };
    const first = buildVoucher(
      base({ id: "eeeeeeee-eeee-4e33-8eee-eeeeeeeeeeee", type: "SALE", lines: [line] }),
    );
    const second = buildVoucher(
      base({
        id: "ffffffff-ffff-4f33-8fff-ffffffffffff",
        type: "SALE",
        lines: [{ ...line, rateAmountPaise: 12_000_000 }],
      }),
    );
    expect(voucherDeltas(first).cashPaise).toBe(10_000_000);
    expect(voucherDeltas(second).cashPaise).toBe(12_000_000);
    expect(first.lines[0]?.lineCashPaise).toBe(10_000_000);
  });

  it("as-of balances include backdated entries (businessDate <= D)", () => {
    const e1 = toLedgerEntry(
      buildVoucher(
        base({
          id: "11111111-aaaa-4a11-8a11-aaaaaaaaaaaa",
          type: "SALE",
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
        }),
      ),
      "sale",
    );
    const backdated = { ...e1, voucherId: "backdated", businessDate: "2026-01-05" };
    expect(balancesAsOf([e1, backdated], "2026-01-07").silverFineMg).toBe(80_000);
    expect(balancesAsOf([e1, backdated], "2026-01-10").silverFineMg).toBe(160_000);
  });

  it("buildVoucher is deterministic (same input, same output)", () => {
    const input = base({
      id: "22222222-bbbb-4b22-8b22-bbbbbbbbbbbb",
      type: "RECEIPT",
      settlement: { cashPaise: 500 },
    });
    expect(buildVoucher(input)).toEqual(buildVoucher(input));
  });
});
