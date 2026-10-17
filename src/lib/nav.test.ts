import { describe, expect, it } from "vitest";
import { needsPartyLookup, parentFor } from "./nav.ts";

describe("deterministic parents", () => {
  it("maps every screen to exactly one parent", () => {
    expect(parentFor("/")).toBeNull();
    expect(parentFor("/parties")).toBe("/");
    expect(parentFor("/parties/new")).toBe("/parties");
    expect(parentFor("/parties/abc")).toBe("/");
    expect(parentFor("/parties/abc/edit")).toBe("/parties/abc");
    expect(parentFor("/parties/abc/bill")).toBe("/parties/abc");
    expect(parentFor("/vouchers/new")).toBe("/");
    expect(parentFor("/vouchers/new/sale", "?party=abc")).toBe("/parties/abc");
    expect(parentFor("/vouchers/new/sale")).toBe("/vouchers/new");
    expect(parentFor("/summary")).toBe("/");
    expect(parentFor("/settings/backup")).toBe("/");
    expect(parentFor("/settings/items")).toBe("/settings/backup");
    expect(parentFor("/stock")).toBe("/");
    expect(parentFor("/stock/item")).toBe("/stock");
    expect(parentFor("/stock/move")).toBe("/stock");
    expect(parentFor("/stock/move", "?mode=adjust&metal=SILVER&name=Payal")).toBe("/stock/item?metal=SILVER&name=Payal");
    expect(parentFor("/stock/move", "?mode=seed")).toBe("/stock");
    expect(parentFor("/nope")).toBe("/");
  });

  it("flags voucher detail for party lookup", () => {
    expect(needsPartyLookup("/vouchers/abc")).toBe(true);
    expect(needsPartyLookup("/vouchers/new/sale")).toBe(false);
  });
});
