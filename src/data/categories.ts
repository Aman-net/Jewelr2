import { db } from "./db.ts";
import type { JewelrDb } from "./db.ts";
import { clearItemCfg, moveItemCfg } from "./stock.ts";

/**
 * Item (category) master. Presets ship with the app; anything the operator
 * types becomes a custom item; usage counts keep recent/most-used first.
 * Names match case-insensitively ("payal" === "Payal").
 */
export const PRESET_CATEGORIES: Record<"GOLD" | "SILVER", string[]> = {
  GOLD: ["Biscuit", "Coin", "Bar", "Kangan", "Bangle", "Chain", "Necklace", "Ring", "Earring", "Pendant"],
  SILVER: ["Payal", "Bichiya", "Chain", "Ring", "Earring", "Coin", "Bar", "Anklet", "Utensils", "Article"],
};

interface UseRecord {
  count: number;
  lastUsed: string;
  name: string;
}

const keyFor = (metal: string, name: string) => `catUse:${metal}:${name.trim().toLowerCase()}`;
const customKeyFor = (metal: string) => `catCustom:${metal}`;

function parseUse(value: string | undefined): UseRecord | undefined {
  if (!value) return undefined;
  try {
    const r = JSON.parse(value) as UseRecord;
    if (typeof r.count === "number" && typeof r.lastUsed === "string" && typeof r.name === "string") return r;
    return undefined;
  } catch {
    return undefined;
  }
}

/** Record that an item was used on a posted voucher. Fire-and-forget safe. */
export async function recordCategoryUse(
  metal: "GOLD" | "SILVER",
  name: string,
  dbx: JewelrDb = db,
): Promise<void> {
  const clean = name.trim();
  if (!clean) return;
  const key = keyFor(metal, clean);
  const prev = parseUse((await dbx.app_settings.get(key))?.value);
  await dbx.app_settings.put({
    key,
    value: JSON.stringify({
      count: (prev?.count ?? 0) + 1,
      lastUsed: new Date().toISOString(),
      name: clean,
    } satisfies UseRecord),
  });
}

export interface CategorySuggestions {
  /** Top recent by lastUsed (max 4). */
  recent: string[];
  /** Presets not already in recent. */
  presets: string[];
  /** Owner-added + previously used customs, not already in recent. */
  custom: string[];
}

/** Owner-managed custom items for a metal (the controlled vocabulary). */
export async function getCustoms(metal: "GOLD" | "SILVER", dbx: JewelrDb = db): Promise<string[]> {
  const row = await dbx.app_settings.get(customKeyFor(metal));
  if (!row) return [];
  try {
    const list = JSON.parse(row.value) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  } catch {
    return [];
  }
}

async function putCustoms(metal: "GOLD" | "SILVER", names: string[], dbx: JewelrDb): Promise<string[]> {
  const clean = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0 && n.length <= 60))];
  await dbx.app_settings.put({ key: customKeyFor(metal), value: JSON.stringify(clean) });
  return clean;
}

/** Add an item to the owner's list. Case-insensitive; no duplicates. */
export async function addCustom(
  metal: "GOLD" | "SILVER",
  name: string,
  dbx: JewelrDb = db,
): Promise<string[]> {
  const clean = name.trim();
  if (!clean) throw new Error("Item name is required");
  const current = await getCustoms(metal, dbx);
  if (current.some((n) => n.toLowerCase() === clean.toLowerCase())) return current;
  if (PRESET_CATEGORIES[metal].some((p) => p.toLowerCase() === clean.toLowerCase())) return current;
  return putCustoms(metal, [...current, clean], dbx);
}

/** Rename a custom item (master only — posted history keeps its strings). */
export async function renameCustom(
  metal: "GOLD" | "SILVER",
  oldName: string,
  newName: string,
  dbx: JewelrDb = db,
): Promise<string[]> {
  const clean = newName.trim();
  if (!clean) throw new Error("Item name is required");
  const current = await getCustoms(metal, dbx);
  const idx = current.findIndex((n) => n.toLowerCase() === oldName.trim().toLowerCase());
  if (idx === -1) throw new Error(`Item not found: ${oldName}`);
  if (current.some((n, i) => i !== idx && n.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Item already exists: ${clean}`);
  }
  const next = [...current];
  next[idx] = clean;
  if (PRESET_CATEGORIES[metal].some((p) => p.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`“${clean}” is already a standard item`);
  }
  // Move the usage record so recency survives the rename.
  const oldKey = keyFor(metal, oldName);  const oldUse = parseUse((await dbx.app_settings.get(oldKey))?.value);
  await dbx.transaction("rw", [dbx.app_settings], async () => {
    await putCustoms(metal, next, dbx);
    await moveItemCfg(metal, oldName, clean, dbx);
    if (oldUse) {
      const targetKey = keyFor(metal, clean);
      const targetUse = parseUse((await dbx.app_settings.get(targetKey))?.value);
      await dbx.app_settings.put({
        key: targetKey,
        value: JSON.stringify({
          count: (targetUse?.count ?? 0) + oldUse.count,
          lastUsed: oldUse.lastUsed > (targetUse?.lastUsed ?? "") ? oldUse.lastUsed : (targetUse?.lastUsed ?? oldUse.lastUsed),
          name: clean,
        } satisfies UseRecord),
      });
      await dbx.app_settings.delete(oldKey);
    }
  });
  return next;
}

/** Remove a custom item from the master. Posted history is untouched. */
export async function deleteCustom(
  metal: "GOLD" | "SILVER",
  name: string,
  dbx: JewelrDb = db,
): Promise<string[]> {
  const current = await getCustoms(metal, dbx);
  const next = current.filter((n) => n.toLowerCase() !== name.trim().toLowerCase());
  if (next.length === current.length) throw new Error(`Item not found: ${name}`);
  await dbx.transaction("rw", [dbx.app_settings], async () => {
    await putCustoms(metal, next, dbx);
    await clearItemCfg(metal, name, dbx);
    await dbx.app_settings.delete(keyFor(metal, name));
  });
  return next;
}

/**
 * Suggestions for the picker: recent first, then standard presets, then the
 * owner's customs. One source of truth (usage records + explicit customs) —
 * no line-table scan, so names stay exactly as the owner spelled them.
 */
export async function getCategorySuggestions(
  metal: "GOLD" | "SILVER",
  dbx: JewelrDb = db,
): Promise<CategorySuggestions> {
  const prefix = `catUse:${metal}:`;
  const settings = await dbx.app_settings.where("key").startsWith(prefix).toArray();
  const uses = settings
    .map((s) => parseUse(s.value))
    .filter((x): x is UseRecord => x !== undefined)
    .sort((a, b) => b.lastUsed.localeCompare(a.lastUsed));

  const presetSet = new Set(PRESET_CATEGORIES[metal].map((p) => p.toLowerCase()));
  const recent = uses.slice(0, 4).map((u) => u.name);
  const recentSet = new Set(recent.map((r) => r.toLowerCase()));
  const customs = await getCustoms(metal, dbx);
  const usedCustoms = uses.map((u) => u.name).filter((n) => !presetSet.has(n.toLowerCase()));
  const custom = [...customs, ...usedCustoms]
    .filter((n, i, arr) => !recentSet.has(n.toLowerCase()) && arr.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i)
    .sort((a, b) => a.localeCompare(b));
  return {
    recent,
    presets: PRESET_CATEGORIES[metal].filter((p) => !recentSet.has(p.toLowerCase())),
    custom,
  };
}
