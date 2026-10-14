import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearDb, createTestDb, db } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { createParty, getParty, listParties, searchParties, updateParty } from "./parties.ts";

let tdb: JewelrDb;
beforeEach(async () => {
  tdb = createTestDb("test-parties");
  await clearDb(tdb);
  void db;
});

describe("parties", () => {
  it("creates a party with role flags", async () => {
    const { party, duplicateName } = await createParty(
      { name: "Sharma Bullion", mobile: "98200 12345", isCustomer: true, isSupplier: false },
      tdb,
    );
    expect(duplicateName).toBe(false);
    expect(party.name).toBe("Sharma Bullion");
    expect(await getParty(party.id, tdb)).toEqual(party);
  });

  it("warns on duplicate names (case-insensitive) without blocking", async () => {
    await createParty({ name: "Sharma Bullion", isCustomer: true, isSupplier: true }, tdb);
    const second = await createParty({ name: "  sharma bullion ", isCustomer: true, isSupplier: false }, tdb);
    expect(second.duplicateName).toBe(true);
    expect(await listParties({}, tdb)).toHaveLength(2);
  });

  it("rejects a party with no role flag and writes nothing", async () => {
    await expect(
      createParty({ name: "Nobody", isCustomer: false, isSupplier: false }, tdb),
    ).rejects.toThrow();
    expect(await listParties({ includeInactive: true }, tdb)).toHaveLength(0);
  });

  it("searches by name and mobile, skipping inactive", async () => {
    const a = await createParty({ name: "Sharma Bullion", mobile: "9820012345", isCustomer: true, isSupplier: false }, tdb);
    await createParty({ name: "Verma Sons", mobile: "98111 00000", isCustomer: false, isSupplier: true }, tdb);
    await updateParty(a.party.id, { active: false }, tdb);
    expect(await searchParties("sharma", tdb)).toHaveLength(0);
    expect((await searchParties("verma", tdb)).map((p) => p.name)).toEqual(["Verma Sons"]);
    expect((await searchParties("98111", tdb)).map((p) => p.name)).toEqual(["Verma Sons"]);
    expect(await searchParties("", tdb)).toHaveLength(1);
  });

  it("records party edits as audit events", async () => {
    const { party } = await createParty({ name: "Sharma", isCustomer: true, isSupplier: false }, tdb);
    const updated = await updateParty(party.id, { mobile: "98000 00000", notes: "old khata p.12" }, tdb);
    expect(updated.mobile).toBe("98000 00000");
    const events = await tdb.audit_events.where("entityId").equals(party.id).toArray();
    expect(events).toHaveLength(1);
    expect(events[0]?.action).toBe("update");
  });

  it("rejects edits that clear both role flags and unknown ids", async () => {
    const { party } = await createParty({ name: "Sharma", isCustomer: true, isSupplier: false }, tdb);
    await expect(updateParty(party.id, { isCustomer: false }, tdb)).rejects.toThrow();
    await expect(updateParty("00000000-0000-4000-8000-000000000000", { notes: "x" }, tdb)).rejects.toThrow(
      /not found/,
    );
  });
});
