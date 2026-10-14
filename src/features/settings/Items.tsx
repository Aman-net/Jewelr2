import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Plus, Tags } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { addCustom, deleteCustom, getCustoms, renameCustom } from "../../data/index.ts";
import { PRESET_CATEGORIES } from "../../data/index.ts";
import type { MetalType } from "../../domain/index.ts";
import { en } from "../../i18n/en.ts";
import { initialsOf } from "../../components/ui/PartyAvatar.tsx";

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

  const addDraft = () => run(async () => {
    await addCustom(metal, draft);
    setDraft("");
  });

  return (
    <Page title={en.item.manage} backTo="/settings/backup" backLabel="Settings">
      <Segmented
        options={["GOLD", "SILVER"] as const}
        value={metal}
        onChange={(m) => { setMetal(m); setEditing(null); setConfirmDelete(null); setError(""); }}
        labels={{ GOLD: "Gold items", SILVER: "Silver items" }}
      />
      <Card>
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add item, e.g. Kadi"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addDraft();
              }
            }}
          />
          <Button
            disabled={busy || !draft.trim()}
            onClick={addDraft}
            className="shrink-0 px-5"
          >
            <Plus size={18} /> Add
          </Button>
        </div>
      </Card>

      <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">
        {en.item.yours} · {(customs ?? []).length}
      </div>
      {(customs ?? []).length === 0 && (
        <Card><p className="text-sm text-stone-500">None yet — add the items your shop deals in above.</p></Card>
      )}
      {(customs ?? []).map((name) => (
        <Card key={name}>
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
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800">
                {initialsOf(name)}
              </span>
              <span className="min-w-0 flex-1 truncate text-base font-medium text-stone-900">{name}</span>
              {confirmDelete === name ? (
                <button
                  className="shrink-0 rounded-full bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => run(async () => {
                    await deleteCustom(metal, name);
                    setConfirmDelete(null);
                  })}
                >
                  Confirm?
                </button>
              ) : (
                <span className="flex shrink-0 gap-3">
                  <button
                    className="text-sm font-medium text-amber-800"
                    onClick={() => { setEditing(name); setEditValue(name); setConfirmDelete(null); }}
                  >
                    Rename
                  </button>
                  <button className="text-sm font-medium text-red-700" onClick={() => setConfirmDelete(name)}>
                    Delete
                  </button>
                </span>
              )}
            </div>
          )}
        </Card>
      ))}

      <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          {en.item.presets} · {PRESET_CATEGORIES[metal].length} standard
        </summary>
        <div className="flex flex-wrap gap-1.5 pt-3">
          {PRESET_CATEGORIES[metal].map((p) => (
            <span key={p} className="flex items-center gap-1.5 rounded-full bg-stone-100 py-1.5 pl-2 pr-3 text-sm text-stone-600">
              <Tags size={14} /> {p}
            </span>
          ))}
        </div>
      </details>
      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div> : null}
      <p className="text-xs text-stone-500">{en.item.historyNote}</p>
    </Page>
  );
}
