import { useMemo, useState } from "react";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { Field, Input } from "../../components/ui/Field.tsx";

/** Searchable party picker. Small scale: filters the live party list locally. */
export function PartyPicker({ value, onChange, error }: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const parties = usePartyList();
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = parties ?? [];
    if (!query) return list.slice(0, 8);
    return list
      .filter((p) => p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query))
      .slice(0, 8);
  }, [parties, q]);
  const selected = (parties ?? []).find((p) => p.id === value);
  return (
    <Field label={en.voucher.party} error={error}>
      <Input
        placeholder={en.party.search}
        value={selected && !q ? selected.name : q}
        onChange={(e) => {
          setQ(e.target.value);
          if (value) onChange("");
        }}
      />
      {(!selected || q) && (
        <div className="mt-1 max-h-44 overflow-y-auto rounded-xl border border-stone-200 bg-white">
          {matches.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2.5 text-left text-base active:bg-amber-50"
              onClick={() => {
                onChange(p.id);
                setQ("");
              }}
            >
              <span className="font-medium text-stone-900">{p.name}</span>
              {p.mobile ? <span className="text-sm text-stone-500">{p.mobile}</span> : null}
            </button>
          ))}
          {matches.length === 0 && <div className="px-3 py-2.5 text-sm text-stone-500">No matches</div>}
        </div>
      )}
    </Field>
  );
}
