import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { CheckRow, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { getParty, updateParty } from "../../data/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";

/** Dedicated edit screen — khata stays a reading surface, editing gets full focus. */
export function PartyEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const party = useLiveQuery(() => getParty(id), [id]);

  if (party === undefined) return <Page title="Edit party"><Card><p className="text-sm text-stone-500">Loading…</p></Card></Page>;
  if (!party) return <Page title="Edit party"><Card><p className="text-sm text-stone-500">Party not found.</p></Card></Page>;

  return (
    <Page title={`Edit ${party.name}`} backTo={`/parties/${party.id}`} backLabel="Khata">
      <EditPartyForm
        partyId={party.id}
        initial={{ name: party.name, mobile: party.mobile ?? "", address: party.address ?? "", notes: party.notes ?? "", active: party.active }}
        onDone={() => navigate(`/parties/${party.id}`)}
      />
    </Page>
  );
}

function EditPartyForm({ partyId, initial, onDone }: {
  partyId: string;
  initial: { name: string; mobile: string; address: string; notes: string; active: boolean };
  onDone: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [mobile, setMobile] = useState(initial.mobile);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const partyList = usePartyList();
  const duplicateName = (partyList ?? []).some(
    (p) => p.id !== partyId && p.name.trim().toLowerCase() === name.trim().toLowerCase() && name.trim().length > 0,
  );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          setSaving(true);
          setError("");
          try {
            if (!name.trim()) throw new Error("Name is required");
            await updateParty(partyId, {
              name: name.trim(),
              mobile: mobile.trim() || undefined,
              address: address.trim() || undefined,
              notes: notes.trim() || undefined,
              active,
            });
            onDone();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save");
          } finally {
            setSaving(false);
          }
        })();
      }}
    >
      <Card>
        <div className="flex flex-col gap-3">
          <Field
            label={en.party.name}
            error={undefined}
            hint={duplicateName ? en.party.duplicateWarn : undefined}
          >
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Field label={en.party.mobile}><Input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" /></Field>
          <Field label={en.party.address}><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></Field>
          <Field label={en.party.notes}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
          <CheckRow label={en.party.active}>
            <input type="checkbox" className="h-6 w-6 accent-amber-700" checked={active} onChange={(e) => setActive(e.target.checked)} />
          </CheckRow>
          {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
        </div>
      </Card>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : en.common.save}</Button>
    </form>
  );
}
