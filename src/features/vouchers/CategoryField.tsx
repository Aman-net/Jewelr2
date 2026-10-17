import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link } from "react-router";
import { addCustom, getCategorySuggestions } from "../../data/index.ts";
import type { MetalType } from "../../domain/index.ts";
import { en } from "../../i18n/en.ts";
import { Chip, EmptyState, Sheet } from "../../components/ui/Bits.tsx";
import { Field, SearchInput } from "../../components/ui/Field.tsx";

/**
 * Item picker: recent first, then presets, then previously-used customs,
 * plus free-text custom entry. Opens in a bottom sheet — no dropdowns.
 */
export function CategoryField({ metal, value, onPick }: {
  metal: MetalType;
  value: string;
  onPick: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const suggestions = useLiveQuery(() => getCategorySuggestions(metal), [metal]);
  const query = q.trim().toLowerCase();
  const match = (name: string) => !query || name.toLowerCase().includes(query);
  const recent = (suggestions?.recent ?? []).filter(match);
  const presets = (suggestions?.presets ?? []).filter(match);
  const custom = (suggestions?.custom ?? []).filter(match);
  const exactHit =
    query &&
    [...(suggestions?.recent ?? []), ...(suggestions?.presets ?? []), ...(suggestions?.custom ?? [])].some(
      (n) => n.toLowerCase() === query,
    );

  const pick = (name: string) => {
    // New names join the owner's list so spellings stay fixable later.
    void addCustom(metal, name).catch(() => {});
    onPick(name);
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <Field label={en.item.label}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[52px] w-full items-center justify-between rounded-xl border border-stone-300 bg-white px-3 text-left transition-[background-color,border-color] duration-150 active:border-amber-300 active:bg-amber-50"
        >
          <span className={value ? "text-base font-medium text-stone-900" : "text-base text-stone-400"}>
            {value || en.item.pick}
          </span>
          <span className="text-lg text-stone-400">›</span>
        </button>
      </Field>
      {open && (
        <Sheet title={`Pick ${metal === "GOLD" ? "gold" : "silver"} item`} onClose={() => { setOpen(false); setQ(""); }}>
          <div className="flex flex-col gap-3">
            <SearchInput placeholder={en.item.search} value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" autoFocus />
            {recent.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{en.item.recent}</div>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((n) => <Chip key={n} onClick={() => pick(n)}>{n}</Chip>)}
                </div>
              </div>
            )}
            {presets.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{en.item.presets}</div>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((n) => <Chip key={n} onClick={() => pick(n)}>{n}</Chip>)}
                </div>
              </div>
            )}
            {custom.length > 0 && (
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500">{en.item.custom}</div>
                <div className="flex flex-wrap gap-1.5">
                  {custom.map((n) => <Chip key={n} onClick={() => pick(n)}>{n}</Chip>)}
                </div>
              </div>
            )}
            {recent.length + presets.length + custom.length === 0 && query && !exactHit && (
              <EmptyState title="No match" hint="Save it as a new item name." />
            )}
            {query && !exactHit && (
              <button
                type="button"
                onClick={() => pick(q.trim().replace(/\b\w/g, (c) => c.toUpperCase()))}
                className="anim-fade rounded-xl bg-amber-800 px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 active:bg-amber-900"
              >
                + Use “{q.trim()}” as new item
              </button>
            )}
            <Link to="/settings/items" className="self-center text-sm font-medium text-amber-800">
              {en.item.manage} ›
            </Link>
          </div>
        </Sheet>
      )}
    </>
  );
}
