import { useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Input } from "../../components/ui/Field.tsx";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";

export function PartyListPage() {
  const parties = usePartyList();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = (parties ?? []).filter(
    (p) => !query || p.name.toLowerCase().includes(query) || (p.mobile ?? "").includes(query),
  );
  return (
    <Page
      title={en.party.title}
      action={<Link to="/parties/new"><Button>{en.party.add}</Button></Link>}
    >
      <Input placeholder={en.party.search} value={q} onChange={(e) => setQ(e.target.value)} inputMode="search" />
      {parties === undefined && <Card><p className="text-sm text-stone-500">Loading…</p></Card>}
      {matches.map((p) => (
        <Link key={p.id} to={`/parties/${p.id}`}>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-stone-900">{p.name}</div>
                <div className="text-xs text-stone-500">
                  {[p.isCustomer ? en.party.customer : "", p.isSupplier ? en.party.supplier : ""].filter(Boolean).join(" · ")}
                  {p.mobile ? ` · ${p.mobile}` : ""}
                </div>
              </div>
              <span className="text-lg text-stone-400">›</span>
            </div>
          </Card>
        </Link>
      ))}
      {parties !== undefined && matches.length === 0 && (
        <Card><p className="text-sm text-stone-500">No parties yet. Add your first party to start the khata.</p></Card>
      )}
    </Page>
  );
}
