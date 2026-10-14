import { Link } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { useAllBalancesLive, useRecentVouchersLive } from "../../hooks/useLive.ts";
import { formatINR } from "../../lib/format.ts";

const quick = [
  { to: "/vouchers/new/sale", label: "New sale" },
  { to: "/vouchers/new/purchase", label: "New purchase" },
  { to: "/vouchers/new/receipt", label: "Receive" },
  { to: "/vouchers/new/payment", label: "Pay" },
  { to: "/vouchers/new/conversion", label: "Convert" },
  { to: "/parties/new", label: "Add party" },
];

export function HomePage() {
  const balances = useAllBalancesLive();
  const recent = useRecentVouchersLive(8);
  const totals = Object.values(balances ?? {}).reduce(
    (t, b) => ({ cash: t.cash + b.cashPaise, gold: t.gold + b.goldFineMg, silver: t.silver + b.silverFineMg }),
    { cash: 0, gold: 0, silver: 0 },
  );
  return (
    <Page title="Today">
      <div className="grid grid-cols-3 gap-2">
        {quick.slice(0, 3).map((q) => (
          <Link key={q.to} to={q.to}><Button full>{q.label}</Button></Link>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {quick.slice(3).map((q) => (
          <Link key={q.to} to={q.to}><Button variant="secondary" full>{q.label}</Button></Link>
        ))}
      </div>
      <Card>
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-stone-500">All parties · net</div>
        <div className="text-lg font-semibold text-stone-900">{formatINR(totals.cash)}</div>
        <div className="text-xs text-stone-500">
          Gold {(totals.gold / 1000).toFixed(3)} g · Silver {(totals.silver / 1000).toFixed(3)} g fine
        </div>
      </Card>
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-700">Recent</div>
        <div className="flex flex-col gap-1">
          {(recent ?? []).map((v) => (
            <Link key={v.id} to={`/vouchers/${v.id}`} className="flex items-baseline justify-between gap-2 border-b border-stone-100 py-1.5 last:border-0">
              <span className="truncate text-sm font-medium text-stone-900">{v.type}</span>
              <span className="shrink-0 text-xs text-stone-500">{v.businessDate}</span>
            </Link>
          ))}
          {(recent ?? []).length === 0 && <p className="text-sm text-stone-500">No vouchers yet.</p>}
        </div>
      </Card>
    </Page>
  );
}
