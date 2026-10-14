import { Link } from "react-router";
import { Page } from "../../components/ui/Card.tsx";

const entries = [
  { to: "sale", title: "Sell goods", hint: "You gave gold/silver — party owes you" },
  { to: "receipt", title: "Got payment", hint: "Party paid you cash or metal" },
  { to: "purchase", title: "Buy goods", hint: "You took gold/silver — you owe" },
  { to: "payment", title: "Paid out", hint: "You paid cash or metal" },
  { to: "conversion", title: "Fix rate", hint: "Turn metal dues into cash or back" },
  { to: "opening", title: "Opening balance", hint: "Old khata balance for a party" },
] as const;

/** What happened? Plain operator language, then the right form. */
export function NewEntryPicker() {
  return (
    <Page title="New entry">
      <div className="flex flex-col gap-2">
        {entries.map((e) => (
          <Link key={e.to} to={`/vouchers/new/${e.to}`}>
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm active:bg-amber-50">
              <div>
                <div className="text-base font-semibold text-stone-900">{e.title}</div>
                <div className="text-sm text-stone-500">{e.hint}</div>
              </div>
              <span className="text-xl text-stone-300">›</span>
            </div>
          </Link>
        ))}
      </div>
    </Page>
  );
}
