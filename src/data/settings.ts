import { db } from "./db.ts";
import type { JewelrDb } from "./db.ts";

/** Last rate the operator typed for a metal, for labelled prefill (never silent). */
export interface LastRate {
  amountPaise: number;
  unit: "GOLD_PER_10G" | "SILVER_PER_KG";
  at: string;
}

const lastRateKey = (metal: "GOLD" | "SILVER") => `lastRate:${metal}`;

export async function getLastRate(metal: "GOLD" | "SILVER", dbx: JewelrDb = db): Promise<LastRate | undefined> {
  const row = await dbx.app_settings.get(lastRateKey(metal));
  if (!row) return undefined;
  try {
    return JSON.parse(row.value) as LastRate;
  } catch {
    return undefined;
  }
}

export async function setLastRate(
  metal: "GOLD" | "SILVER",
  rate: Omit<LastRate, "at">,
  dbx: JewelrDb = db,
): Promise<void> {
  await dbx.app_settings.put({
    key: lastRateKey(metal),
    value: JSON.stringify({ ...rate, at: new Date().toISOString() }),
  });
}
