import { db } from "../data/db.ts";

export const STORAGE_KEY = "storagePersisted";

/**
 * Ask the browser to exempt our IndexedDB from automatic eviction.
 * Runs once per install; the result is shown in Settings → About.
 * Phase 4 gate: installability + durability messaging, not a guarantee —
 * exports remain the real backup.
 */
export async function ensurePersistence(): Promise<boolean> {
  try {
    let persisted = false;
    if (navigator.storage?.persist) persisted = await navigator.storage.persist();
    const prev = (await db.app_settings.get(STORAGE_KEY))?.value;
    if (prev !== String(persisted)) {
      await db.app_settings.put({ key: STORAGE_KEY, value: String(persisted) });
    }
    return persisted;
  } catch {
    return false;
  }
}
