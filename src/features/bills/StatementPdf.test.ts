import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { g3, pairNote, rs2, rowHead, signed2, signedG3, statementNo } from "./StatementPdf.tsx";
import { StatementDoc } from "./StatementPdf.tsx";

describe("statement pdf helpers", () => {
  it("numbers are pdf-safe with metal precision", () => {
    expect(rs2(12500)).toBe("Rs 125.00");
    expect(g3(20000, "GOLD")).toBe("20.000 g");
    expect(g3(20000, "SILVER")).toBe("20 g");
    expect(signed2(-20000)).toBe("-200.00");
    expect(signed2(0)).toBe("—");
    expect(signedG3(50000, "GOLD")).toBe("+50.000");
    expect(signedG3(50000, "SILVER")).toBe("+50");
  });

  it("heads carry pair serials and pair notes name the reversal", () => {
    expect(rowHead("CONVERSION", undefined)).toBe("Rate fix");
    expect(pairNote(0, 0, 0, "wrong rate")).toBe("and its reversal · no net effect — wrong rate");
    expect(pairNote(100, 0, 0, undefined)).toBe("and its reversal");
  });

  it("statement numbers are deterministic per party+period", () => {
    const a = statementNo("party-1", "2026-10-01", "2026-10-15");
    expect(statementNo("party-1", "2026-10-01", "2026-10-15")).toBe(a);
    expect(a).toMatch(/^KS-20261015-\d{3}$/);
    expect(statementNo("party-2", "2026-10-01", "2026-10-15")).not.toBe(a);
  });

  it("renders a silver-only doc to bytes without crashing", async () => {
    const doc = createElement(StatementDoc, {
      partyName: "Riya",
      from: "2026-10-01",
      to: "2026-10-15",
      fromLabel: "1 Oct 2026",
      toLabel: "15 Oct 2026",
      generatedAt: "15 Oct 2026, 2:25 am",
      no: "KS-20261015-001",
      opening: { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 },
      openingLabel: "OPENING BALANCE · BEFORE 1 Oct 2026",
      days: [
        {
          date: "1 Oct 2026",
          rows: [
            {
              sno: "1",
              head: "Sale · Silver Chain",
              details: ["25.000 g gross x 80% tunch = 20.000 g fine · rate: open"],
              cash: 12500,
              gold: 0,
              silver: 20000,
            },
          ],
          balCash: 12500,
          balGold: 0,
          balSilver: 20000,
        },
      ],
      entryCount: 1,
      totals: { cashPaise: 12500, goldFineMg: 0, silverFineMg: 20000 },
      grossIn: { cashPaise: 12500, goldFineMg: 0, silverFineMg: 20000 },
      grossOut: { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 },
      closing: { cashPaise: 12500, goldFineMg: 0, silverFineMg: 20000 },
      closingLabel: "CLOSING BALANCE AS ON 15 OCT 2026",
      metals: { gold: false, silver: true },
    });
    const buf = await renderToBuffer(doc as unknown as Parameters<typeof renderToBuffer>[0]);
    expect(buf.byteLength).toBeGreaterThan(1000);
  }, 60000);
});
