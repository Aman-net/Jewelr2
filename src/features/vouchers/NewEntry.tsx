import { Link } from "react-router";
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, Percent, TrendingDown, TrendingUp } from "lucide-react";
import { Page } from "../../components/ui/Card.tsx";
import { cn } from "../../lib/cn.ts";

const groups = [
  {
    title: "Goods",
    items: [
      { to: "sale", title: "Sale", hint: "You gave gold/silver — party owes you", Icon: TrendingUp, tint: "bg-amber-100 text-amber-800" },
      { to: "purchase", title: "Purchase", hint: "You took gold/silver — you owe", Icon: TrendingDown, tint: "bg-sky-100 text-sky-800" },
    ],
  },
  {
    title: "Money & metal",
    items: [
      { to: "receipt", title: "Receive", hint: "Party paid you cash or metal", Icon: ArrowDownToLine, tint: "bg-emerald-100 text-emerald-800" },
      { to: "payment", title: "Pay Out", hint: "You paid cash or metal", Icon: ArrowUpFromLine, tint: "bg-orange-100 text-orange-800" },
    ],
  },
  {
    title: "Khata",
    items: [
      { to: "conversion", title: "Convert", hint: "Turn metal dues into cash or back (fix rate)", Icon: Percent, tint: "bg-violet-100 text-violet-800" },
      { to: "opening", title: "Opening balance", hint: "Old khata balance for a party", Icon: BookOpen, tint: "bg-stone-200 text-stone-700" },
    ],
  },
] as const;

/** What happened? Grouped action tiles in operator language. */
export function NewEntryPicker() {
  return (
    <Page title="New entry" backTo="/" backLabel="Home">
      <p className="-mt-2 text-sm text-stone-500">What just happened? Pick one — the rest follows.</p>
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 mt-1 text-xs font-semibold uppercase tracking-widest text-stone-500">{g.title}</div>
          <div className="grid grid-cols-2 gap-2">
            {g.items.map((e) => (
              <Link key={e.to} to={`/vouchers/new/${e.to}`}>
                <div className="flex h-full flex-col items-start gap-2 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm active:bg-amber-50">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", e.tint)}>
                    <e.Icon size={20} />
                  </span>
                  <span>
                    <span className="block text-base font-semibold text-stone-900">{e.title}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-stone-500">{e.hint}</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </Page>
  );
}
