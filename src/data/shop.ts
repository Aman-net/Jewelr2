import { db } from "./db.ts";
import type { JewelrDb } from "./db.ts";

/**
 * Shop identity printed on the bill PDF header and signature block.
 * Device-local, edited once in Settings; rides along in backups via
 * `app_settings`, never in posted history.
 */
export interface ShopDetails {
  name: string;
  address: string;
  phone: string;
  gstin: string;
}

export const EMPTY_SHOP: ShopDetails = { name: "", address: "", phone: "", gstin: "" };

/** app_settings key (JSON blob, same pattern as lastRate). */
export const SHOP_KEY = "shop";

const LIMITS: Record<keyof ShopDetails, number> = { name: 80, address: 160, phone: 40, gstin: 20 };
const LABELS: Record<keyof ShopDetails, string> = {
  name: "Shop name",
  address: "Address",
  phone: "Phone",
  gstin: "GSTIN",
};

/** Collapse runs of whitespace/newlines; reject anything that overflows print. */
function cleanField(v: string, key: keyof ShopDetails): string {
  const s = v.replace(/\s+/g, " ").trim();
  if (s.length > LIMITS[key]) throw new Error(`${LABELS[key]} is too long — keep it under ${LIMITS[key]} characters`);
  return s;
}

export async function getShopDetails(dbx: JewelrDb = db): Promise<ShopDetails> {
  const row = await dbx.app_settings.get(SHOP_KEY);
  if (!row) return { ...EMPTY_SHOP };
  try {
    const r = JSON.parse(row.value) as Partial<ShopDetails>;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return { name: str(r.name), address: str(r.address), phone: str(r.phone), gstin: str(r.gstin) };
  } catch {
    return { ...EMPTY_SHOP };
  }
}

/** Partial patch: any field left out keeps its stored value. Trims and validates. */
export async function setShopDetails(patch: Partial<ShopDetails>, dbx: JewelrDb = db): Promise<ShopDetails> {
  const current = await getShopDetails(dbx);
  const next: ShopDetails = {
    name: cleanField(patch.name ?? current.name, "name"),
    address: cleanField(patch.address ?? current.address, "address"),
    phone: cleanField(patch.phone ?? current.phone, "phone"),
    gstin: cleanField(patch.gstin ?? current.gstin, "gstin"),
  };
  await dbx.app_settings.put({ key: SHOP_KEY, value: JSON.stringify(next) });
  return next;
}
