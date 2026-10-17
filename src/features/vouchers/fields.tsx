import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Sheet } from "../../components/ui/Bits.tsx";
import { Field, SearchInput } from "../../components/ui/Field.tsx";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { cn } from "../../lib/cn.ts";

/**
 * Party dropdown: closed button shows the choice; tap opens a sheet menu
 * with search. Stays usable when the party list grows into the hundreds.
 */
export function PartyPicker({ value, onChange, error }: {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const parties = usePartyList();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = parties ?? [];
    if (!query) return list.slice(0, 50);
    return list
      .filter((p) => p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query))
      .slice(0, 50);
  }, [parties, q]);
  const selected = (parties ?? []).find((p) => p.id === value);

  const close = () => {
    setOpen(false);
    setQ("");
  };

  return (
    <>
      <Field label={en.voucher.party} error={error}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-stone-300 bg-white px-3 text-left transition-[background-color,border-color] duration-150 active:bg-amber-50 active:border-amber-300",
            !selected && "justify-between",
          )}
        >
          {selected ? (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-semibold text-stone-900">{selected.name}</span>
              {selected.mobile ? <span className="text-xs text-stone-500">{selected.mobile}</span> : null}
            </span>
          ) : (
            <>
              <span className="flex-1 text-left text-base text-stone-400">Choose party…</span>
              <span className="text-lg text-stone-400 transition-transform duration-200">▾</span>
            </>
          )}
          {selected ? <span className="shrink-0 text-sm font-medium text-amber-800">Change</span> : null}
        </button>
      </Field>
      {open && (
        <Sheet title={en.voucher.party} onClose={close}>
          <div className="flex flex-col gap-2">
            <SearchInput
              placeholder={en.party.search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              inputMode="search"
              autoFocus
            />
            <div className="flex flex-col">
              {matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="row-press border-b border-stone-100 px-1 py-2.5 text-left last:border-0 active:rounded-lg active:bg-amber-50"
                  onClick={() => {
                    onChange(p.id);
                    close();
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-stone-900">{p.name}</span>
                      {p.mobile ? <span className="block text-xs text-stone-500">{p.mobile}</span> : null}
                    </span>
                    {p.id === value ? <span className="shrink-0 font-bold text-emerald-700">✓</span> : null}
                  </span>
                </button>
              ))}
            </div>
            {matches.length === 0 && (
              <div className="anim-fade rounded-xl bg-stone-50 p-4 text-center">
                <div className="text-sm text-stone-600">No party matches “{q.trim()}”.</div>
                <Link to="/parties/new" className="mt-1 inline-block text-sm font-semibold text-amber-800">
                  + Add new party
                </Link>
              </div>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}
