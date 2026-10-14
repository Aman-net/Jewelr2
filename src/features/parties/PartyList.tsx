import { Link } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { EmptyState } from "../../components/ui/Bits.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import { RoleTags } from "../../components/ui/TypeTag.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { useState } from "react";

export function PartyListPage() {
  const parties = usePartyList();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const query = q.trim().toLowerCase();
  const matches = (parties ?? []).filter(
    (p) =>
      (showInactive || p.active) &&
      (!query || p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query)),
  );
  return (
    <Page
      title={en.party.title}
      action={<Link to="/parties/new"><Button>{en.party.add}</Button></Link>}
    >
      <Input placeholder={en.party.search} value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
      {parties !== undefined && matches.length === 0 && (
        <EmptyState
          title="No parties here"
          hint="Add a party to open their khata."
          action={<Link to="/parties/new"><Button>Add party</Button></Link>}
        />
      )}
      {matches.map((p) => (
        <Link key={p.id} to={`/parties/${p.id}`}>
          <Card>
            <div className="flex items-center gap-3">
              <PartyAvatar name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">
                  {p.name}
                  {!p.active && <span className="ml-2 text-xs font-normal text-stone-400">(inactive)</span>}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <RoleTags isCustomer={p.isCustomer} isSupplier={p.isSupplier} />
                  {p.mobile ? <span className="text-xs text-stone-500">{p.mobile}</span> : null}
                </div>
              </div>
              <span className="shrink-0 text-lg text-stone-300">›</span>
            </div>
          </Card>
        </Link>
      ))}
      <button
        className="self-center text-xs font-medium text-stone-500"
        onClick={() => setShowInactive((s) => !s)}
      >
        {showInactive ? "Hide inactive" : "Show inactive"}
      </button>
    </Page>
  );
}
