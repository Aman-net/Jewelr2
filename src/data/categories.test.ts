import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  PRESET_CATEGORIES,
  addCustom,
  deleteCustom,
  getCategorySuggestions,
  getCustoms,
  recordCategoryUse,
  renameCustom,
} from "./categories.ts";
import { clearDb, createTestDb } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { uuid } from "../lib/uuid.ts";
import { createParty } from "./parties.ts";
import { postVoucher } from "./vouchers.ts";

let tdb: JewelrDb;
beforeEach(async () => {
  tdb = createTestDb(`test-categories-${uuid()}`);
  await clearDb(tdb);
});

describe("item master", () => {
  it("suggests presets for a fresh shop", async () => {
    const s = await getCategorySuggestions("SILVER", tdb);
    expect(s.recent).toEqual([]);
    expect(s.presets).toEqual(PRESET_CATEGORIES.SILVER);
    expect(s.custom).toEqual([]);
  });

  it("puts recently used items first, case-insensitively", async () => {
    await recordCategoryUse("SILVER", "Payal", tdb);
    await recordCategoryUse("SILVER", "payal", tdb);
    await recordCategoryUse("SILVER", "Custom Kadi", tdb);
    const s = await getCategorySuggestions("SILVER", tdb);
    expect(s.recent[0]).toBe("Custom Kadi");
    // Same item re-recorded under different casing: one entry, latest casing.
    expect(s.recent.filter((r) => r.toLowerCase() === "payal")).toEqual(["payal"]);
    expect(s.presets).not.toContain("Payal");
  });

  it("discovers customs from posted lines and records use on post", async () => {
    const partyId = (await createParty({ name: "P1", isCustomer: true, isSupplier: false }, tdb)).party.id;
    await postVoucher(
      {
        type: "SALE",
        partyId,
        businessDate: "2026-01-10",
        lines: [
          {
            metalType: "GOLD",
            categoryName: "Special Kada",
            physicalMg: 10_000,
            agreedTunchScaled: 10_000,
            pricingMode: "METAL_OPEN",
          },
        ],
      },
      tdb,
    );
    const s = await getCategorySuggestions("GOLD", tdb);
    expect(s.recent).toEqual(["Special Kada"]);
    expect(s.custom).toEqual([]);
  });

  it("manages the owner's custom list: add, reject dupes, rename, delete", async () => {
    expect(await addCustom("GOLD", "Kadi", tdb)).toEqual(["Kadi"]);
    expect(await addCustom("GOLD", "  kadi ", tdb)).toEqual(["Kadi"]);
    expect(await addCustom("GOLD", "Biscuit", tdb)).toEqual(["Kadi"]); // preset — no-op
    await expect(addCustom("GOLD", "   ", tdb)).rejects.toThrow();
    expect(await getCustoms("GOLD", tdb)).toEqual(["Kadi"]);

    await recordCategoryUse("GOLD", "Kadi", tdb);
    expect(await renameCustom("GOLD", "Kadi", "Kadi Special", tdb)).toEqual(["Kadi Special"]);
    const after = await getCategorySuggestions("GOLD", tdb);
    expect(after.recent).toEqual(["Kadi Special"]); // recency survives rename
    await expect(renameCustom("GOLD", "Missing", "X", tdb)).rejects.toThrow(/not found/);
    await expect(renameCustom("GOLD", "Kadi Special", "Biscuit", tdb)).rejects.toThrow();

    expect(await deleteCustom("GOLD", "Kadi Special", tdb)).toEqual([]);
    await expect(deleteCustom("GOLD", "Kadi Special", tdb)).rejects.toThrow(/not found/);
    // History keeps its strings; the master no longer suggests the name.
    const gone = await getCategorySuggestions("GOLD", tdb);
    expect(gone.recent).toEqual([]);
    expect(gone.custom).toEqual([]);
  });
});
