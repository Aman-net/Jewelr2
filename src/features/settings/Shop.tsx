import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import type { ChangeEvent } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Card } from "../../components/ui/Card.tsx";
import { Field, Input } from "../../components/ui/Field.tsx";
import { LoadingRow } from "../../components/ui/Loader.tsx";
import { EMPTY_SHOP, getShopDetails, setShopDetails } from "../../data/index.ts";
import type { ShopDetails } from "../../data/index.ts";

/**
 * Shop identity printed at the top of every bill PDF. Kept small and local:
 * one form, saved to `app_settings` (so it rides along in backups).
 */
export function ShopDetailsCard() {
  const shop = useLiveQuery(() => getShopDetails(), []);
  const [form, setForm] = useState<ShopDetails | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (shop !== undefined && form === null) setForm(shop);

  const set = (key: keyof ShopDetails) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...(f ?? EMPTY_SHOP), [key]: e.target.value }));
    setSaved(false);
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      setForm(await setShopDetails(form));
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save shop details");
    } finally {
      setBusy(false);
    }
  };

  if (form === null) return <Card><LoadingRow label="Loading shop details…" /></Card>;

  return (
    <Card>
      <div className="flex flex-col gap-2.5">
        <Field label="Shop name" hint="Prints as the bill header. Leave blank and it shows “My Shop”.">
          <Input value={form.name} onChange={set("name")} placeholder="e.g. Sharma Bullion" />
        </Field>
        <Field label="Address">
          <Input value={form.address} onChange={set("address")} placeholder="e.g. Sarafa Bazar, Indore" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Phone">
            <Input value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="e.g. 98765 43210" />
          </Field>
          <Field label="GSTIN" hint="Optional.">
            <Input value={form.gstin} onChange={set("gstin")} placeholder="e.g. 23ABCDE1234F1Z5" />
          </Field>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-red-700">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void save()}>
          Save shop details
        </Button>
        {saved ? <span className="text-xs font-medium text-emerald-700">Saved</span> : null}
      </div>
    </Card>
  );
}
