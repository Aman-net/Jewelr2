import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { uuid } from "../lib/uuid.ts";
import { EMPTY_SHOP, getShopDetails, setShopDetails } from "./shop.ts";

let tdb: JewelrDb;
beforeEach(async () => {
  tdb = createTestDb(`test-shop-${uuid()}`);
  await clearDb(tdb);
});

describe("shop details", () => {
  it("starts empty and round-trips a saved header", async () => {
    expect(await getShopDetails(tdb)).toEqual(EMPTY_SHOP);
    await setShopDetails({ name: "Sharma Bullion", address: "Sarafa Bazar, Indore", phone: "98765 43210", gstin: "23ABCDE1234F1Z5" }, tdb);
    expect(await getShopDetails(tdb)).toEqual({
      name: "Sharma Bullion",
      address: "Sarafa Bazar, Indore",
      phone: "98765 43210",
      gstin: "23ABCDE1234F1Z5",
    });
  });

  it("patches one field without disturbing the rest", async () => {
    await setShopDetails({ name: "Sharma Bullion", phone: "9999999999" }, tdb);
    await setShopDetails({ address: "Sarafa Bazar" }, tdb);
    expect(await getShopDetails(tdb)).toEqual({ name: "Sharma Bullion", address: "Sarafa Bazar", phone: "9999999999", gstin: "" });
  });

  it("collapses whitespace and trims", async () => {
    await setShopDetails({ name: "  Sharma   Bullion  ", address: "Line one\nLine two" }, tdb);
    expect(await getShopDetails(tdb)).toEqual({ name: "Sharma Bullion", address: "Line one Line two", phone: "", gstin: "" });
  });

  it("rejects an over-long field instead of silently cutting it", async () => {
    await expect(setShopDetails({ name: "x".repeat(81) }, tdb)).rejects.toThrow(/too long/i);
    await expect(setShopDetails({ gstin: "x".repeat(21) }, tdb)).rejects.toThrow(/GSTIN/i);
  });
});
