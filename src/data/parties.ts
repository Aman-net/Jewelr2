import { partySchema } from "../domain/schemas.ts";
import type { Party } from "../domain/types.ts";
import { uuid } from "../lib/uuid.ts";
import { SHOP_ID, clearDb, createTestDb, db } from "./db.ts";
import type { JewelrDb } from "./db.ts";

export interface CreatePartyInput {
  name: string;
  mobile?: string;
  address?: string;
  notes?: string;
  isCustomer: boolean;
  isSupplier: boolean;
}

export interface UpdatePartyPatch {
  name?: string;
  mobile?: string;
  address?: string;
  notes?: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  active?: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Create a party. Duplicate names are a warning, not a block:
 * returns duplicateName=true when another party already has the same
 * trimmed case-insensitive name.
 */
export async function createParty(
  input: CreatePartyInput,
  dbx: JewelrDb = db,
): Promise<{ party: Party; duplicateName: boolean }> {
  const stamp = nowIso();
  const party: Party = {
    id: uuid(),
    shopId: SHOP_ID,
    active: true,
    createdAt: stamp,
    updatedAt: stamp,
    ...input,
  };
  partySchema.parse(party);
  const all = await dbx.parties.where("shopId").equals(SHOP_ID).toArray();
  const duplicateName = all.some((p) => p.name.trim().toLowerCase() === party.name.trim().toLowerCase());
  await dbx.parties.add(party);
  return { party, duplicateName };
}

export async function getParty(id: string, dbx: JewelrDb = db): Promise<Party | undefined> {
  return dbx.parties.get(id);
}

export async function listParties(
  options: { includeInactive?: boolean } = {},
  dbx: JewelrDb = db,
): Promise<Party[]> {
  const all = await dbx.parties.where("shopId").equals(SHOP_ID).sortBy("name");
  return options.includeInactive ? all : all.filter((p) => p.active);
}

/** Search by name or mobile substring, case-insensitive. Empty query lists parties. */
export async function searchParties(query: string, dbx: JewelrDb = db): Promise<Party[]> {
  const q = query.trim().toLowerCase();
  if (!q) return listParties({}, dbx);
  const all = await dbx.parties.where("shopId").equals(SHOP_ID).toArray();
  return all
    .filter((p) => p.active)
    .filter(
      (p) => p.name.toLowerCase().includes(q) || (p.mobile ?? "").toLowerCase().includes(q),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Edit non-financial party fields. Parties carry no balances, so every field
 * here is non-financial; the change is recorded as an AuditEvent.
 */
export async function updateParty(id: string, patch: UpdatePartyPatch, dbx: JewelrDb = db): Promise<Party> {
  const before = await dbx.parties.get(id);
  if (!before) throw new Error(`Party not found: ${id}`);
  const after: Party = { ...before, ...patch, id: before.id, updatedAt: nowIso() };
  partySchema.parse(after);
  await dbx.transaction("rw", [dbx.parties, dbx.audit_events], async () => {
    await dbx.parties.put(after);
    await dbx.audit_events.add({
      id: uuid(),
      entityType: "party",
      entityId: id,
      action: "update",
      before,
      after,
      timestamp: after.updatedAt,
    });
  });
  return after;
}

export { clearDb, createTestDb };
