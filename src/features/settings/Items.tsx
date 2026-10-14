import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { addCustom, deleteCustom, getCustoms, renameCustom } from "../../data/index.ts";
import { PRESET_CATEGORIES } from "../../data/index.ts";
import type { MetalType } from "../../domain/index.ts";
import { en } from "../../i18n/en.ts";

/**
 * Item master management: the owner controls the exact spelling of every
 * pickable item. Renames/deletes touch the master only — posted history
 * keeps its original strings.
 */
export function ItemsPage() {
  const [metal, setMetal] = useState<MetalType>("SILVER");
  const customs = useLiveQuery(() => getCustoms(metal), [metal]);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={en.item.manage}>
      <Segmented
        options={["GOLD", "SILVER"] as const}
        value={metal}
        onChange={(m) => { setMetal(m); setEditing(null); setConfirmDelete(null); setError(""); }}
        labels={{ GOLD: "Gold items", SILVER: "Silver items" }}
      />
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-700">{en.item.yours}</div>
        {(customs ?? []).map((name) => (
          <div key={name} className="border-b border-stone-100 py-2 last:border-0">
            {editing === name ? (
              <div className="flex gap-2">
                <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => run(async () => {
                    await renameCustom(metal, name, editValue);
                    setEditing(null);
                  })}
                >
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-base text-stone-900">{name}</span>
                <span className="flex shrink-0 gap-3">
                  <button
                    className="text-sm font-medium text-amber-800"
                    onClick={() => { setEditing(name); setEditValue(name); setConfirmDelete(null); }}
                  >
                    Rename
                  </button>
                  {confirmDelete === name ? (
                    <button
                      className="text-sm font-semibold text-red-700"
                      onClick={() => run(async () => {
                        await deleteCustom(metal, name);
                        setConfirmDelete(null);
                      })}
                    >
                      Confirm?
                    </button>
                  ) : (
                    <button className="text-sm font-medium text-red-700" onClick={() => setConfirmDelete(name)}>
                      Delete
                    </button>
                  )}
                </span>
              </div>
            )}
          </div>
        ))}
        {(customs ?? []).length === 0 && (
          <p className="text-sm text-stone-500">None yet — add the items your shop deals in.</p>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Kadi"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void run(async () => {
                  await addCustom(metal, draft);
                  setDraft("");
                });
              }
            }}
          />
          <Button
            disabled={busy || !draft.trim()}
            onClick={() => run(async () => {
              await addCustom(metal, draft);
              setDraft("");
            })}
          >
            Add
          </Button>
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-700">{en.item.presets}</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CATEGORIES[metal].map((p) => (
            <span key={p} className="rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-600">{p}</span>
          ))}
        </div>
      </Card>
      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div> : null}
      <p className="text-xs text-stone-500">{en.item.historyNote}</p>
    </Page>
  );
}
