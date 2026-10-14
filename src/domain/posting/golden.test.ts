import { describe, expect, it } from "vitest";
import scenariosDoc from "../../../docs/golden/scenarios.json";
import { buildVoucher, toLedgerEntry } from "../index.ts";
import type {
  BalanceDelta,
  ConversionInput,
  SalePurchaseLineInput,
  SettlementInput,
  VoucherInput,
} from "../index.ts";

const SHOP = "11111111-1111-4111-8111-111111111111";
const PARTIES: Record<string, string> = {
  P1: "22222222-2222-4222-8222-222222222222",
  P2: "33333333-3333-4333-8333-333333333333",
};
const AT = "2026-01-10T10:00:00.000Z";

interface GoldenStep {
  type: VoucherInput["type"];
  party: string;
  date: string;
  lines?: SalePurchaseLineInput[];
  settlement?: SettlementInput;
  conversion?: ConversionInput;
  opening?: BalanceDelta;
}

let counter = 0;
function uuid(n: number): string {
  counter += 1;
  const hex = (n * 7919 + counter * 104729).toString(16).padStart(12, "0").slice(-12);
  return `aaaaaaaa-aaaa-4aaa-8aaa-${hex}`;
}

/**
 * Table-driven replay of docs/golden/scenarios.json through domain + posting.
 * Only OWNER_APPROVED scenarios count as business validation; ILLUSTRATIVE ones pin arithmetic.
 */
describe("golden scenarios", () => {
  for (const s of scenariosDoc.scenarios as unknown as {
    id: string;
    title: string;
    status: string;
    steps: GoldenStep[];
    expect: Record<string, BalanceDelta>;
  }[]) {
    it(`${s.id}: ${s.title} [${s.status}]`, () => {
      const totals: Record<string, BalanceDelta> = {};
      s.steps.forEach((step, i) => {
        const input: VoucherInput = {
          id: uuid(i),
          shopId: SHOP,
          type: step.type,
          partyId: PARTIES[step.party] ?? PARTIES.P1 ?? "",
          businessDate: step.date,
          lines: step.lines,
          settlement: step.settlement,
          conversion: step.conversion,
          opening: step.opening,
          createdAt: AT,
        };
        const voucher = buildVoucher(input);
        const entry = toLedgerEntry(voucher, `${s.id} step ${i}`);
        const prev = totals[step.party] ?? { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
        totals[step.party] = {
          cashPaise: prev.cashPaise + entry.cashDeltaPaise,
          goldFineMg: prev.goldFineMg + entry.goldFineDeltaMg,
          silverFineMg: prev.silverFineMg + entry.silverFineDeltaMg,
        };
      });
      expect(totals).toEqual(s.expect);
    });
  }
});
