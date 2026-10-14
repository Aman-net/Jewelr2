import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { CheckRow, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { getBalances, getParty, updateParty } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";

const actions = [
  { to: "sale", label: "Sale" },
  { to: "purchase", label: "Purchase" },
  { to: "receipt", label: "Receipt" },
  { to: "payment", label: "Payment" },
  { to: "conversion", label: "Conversion" },
  { to: "opening", label: "Opening" },
] as const;

export function PartyDetailPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const duplicateName = (location.state as { duplicateName?: boolean } | null)?.duplicateName;
  const party = useLiveQuery(() => getParty(id), [id]);
  const balances = useLiveQuery(() => getBalances(id), [id]);
  const [editing, setEditing] = useState(false);

  if (party === undefined) return <Page title=""><Card><p className="text-sm text-stone-500">Loading…</p></Card></Page>;
  if (party === null || !party) return <Page title="Party"><Card><p className="text-sm text-stone-500">Party not found.</p></Card></Page>;

  return (
    <Page title={party.name} action={<Button variant="secondary" onClick={() => setEditing((e) => !e)}>{editing ? en.common.cancel : "Edit"}</Button>}>
      {duplicateName ? (
        <div className="rounded-xl bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">{en.party.duplicateWarn}</div>
      ) : null}
      {!party.active ? (
        <div className="rounded-xl bg-stone-200 px-3 py-2 text-sm font-medium text-stone-700">Inactive party</div>
      ) : null}
      <Card>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">Balance · receivable (+), payable (−)</div>
        <BalanceGrid
          cashPaise={balances?.cashPaise ?? 0}
          goldFineMg={balances?.goldFineMg ?? 0}
          silverFineMg={balances?.silverFineMg ?? 0}
        />
      </Card>
      {editing ? (
        <EditForm
          partyId={party.id}
          initial={{ mobile: party.mobile ?? "", address: party.address ?? "", notes: party.notes ?? "", active: party.active }}
          onDone={() => setEditing(false)}
        />
      ) : (
        <Card>
          <div className="flex flex-col gap-1 text-sm">
            <div className="text-stone-700">{[party.isCustomer ? en.party.customer : "", party.isSupplier ? en.party.supplier : ""].filter(Boolean).join(" · ")}</div>
            {party.mobile ? <div className="text-stone-700">{party.mobile}</div> : null}
            {party.address ? <div className="text-stone-500">{party.address}</div> : null}
            {party.notes ? <div className="text-stone-500">{party.notes}</div> : null}
          </div>
        </Card>
      )}
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-700">New voucher</div>
        <div className="grid grid-cols-3 gap-2">
          {actions.map((a) => (
            <Link key={a.to} to={`/vouchers/new/${a.to}?party=${party.id}`}>
              <Button variant="secondary" full>{a.label}</Button>
            </Link>
          ))}
        </div>
        <Link to={`/parties/${party.id}/ledger`} className="mt-2 block">
          <Button variant="ghost" full>View ledger ›</Button>
        </Link>
      </Card>
    </Page>
  );
}

function EditForm({ partyId, initial, onDone }: {
  partyId: string;
  initial: { mobile: string; address: string; notes: string; active: boolean };
  onDone: () => void;
}) {
  const [mobile, setMobile] = useState(initial.mobile);
  const [address, setAddress] = useState(initial.address);
  const [notes, setNotes] = useState(initial.notes);
  const [active, setActive] = useState(initial.active);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <Field label={en.party.mobile}><Input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" /></Field>
        <Field label={en.party.address}><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></Field>
        <Field label={en.party.notes}><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></Field>
        <CheckRow label={en.party.active}>
          <input type="checkbox" className="h-6 w-6 accent-amber-700" checked={active} onChange={(e) => setActive(e.target.checked)} />
        </CheckRow>
        {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await updateParty(partyId, {
                mobile: mobile.trim() || undefined,
                address: address.trim() || undefined,
                notes: notes.trim() || undefined,
                active,
              });
              onDone();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save");
            } finally {
              setSaving(false);
            }
          }}
        >
          {en.common.save}
        </Button>
      </div>
    </Card>
  );
}
