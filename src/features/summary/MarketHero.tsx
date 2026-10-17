import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BalanceGrid } from "../../components/ui/Card.tsx";
import { cn } from "../../lib/cn.ts";
import { getAllDuesSplits } from "../../data/index.ts";

/**
 * Dark market-dues hero: net position across all parties, viewable through a
 * Total / Customers / Suppliers lens. Shared by Home and Summary so the two
 * screens speak the same numbers.
 */
export function MarketHero() {
  const splits = useLiveQuery(() => getAllDuesSplits(), []);
  const [duesView, setDuesView] = useState<"combined" | "sale" | "purchase">("combined");

  // Market-wide buckets: what customers owe you (sale) vs what you owe
  // suppliers (purchase). Netting them hides both flows — hence the toggle.
  const market = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  const marketSale = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  const marketPurchase = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  for (const s of Object.values(splits ?? {})) {
    market.cashPaise += s.combined.cashPaise;
    market.goldFineMg += s.combined.goldFineMg;
    market.silverFineMg += s.combined.silverFineMg;
    marketSale.cashPaise += s.sale.cashPaise;
    marketSale.goldFineMg += s.sale.goldFineMg;
    marketSale.silverFineMg += s.sale.silverFineMg;
    marketPurchase.cashPaise += s.purchase.cashPaise;
    marketPurchase.goldFineMg += s.purchase.goldFineMg;
    marketPurchase.silverFineMg += s.purchase.silverFineMg;
  }
  const hero = duesView === "combined" ? market : duesView === "sale" ? marketSale : marketPurchase;

  return (
    <div className="rounded-3xl bg-stone-900 p-5 text-white shadow-md">
      <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-400">
        {hero.cashPaise >= 0 ? "Market owes you" : "You owe market"}
      </div>
      <BalanceGrid cashPaise={hero.cashPaise} goldFineMg={hero.goldFineMg} silverFineMg={hero.silverFineMg} dark />
      {duesView !== "combined" && (
        <div className="mt-2 text-[11px] text-stone-400">
          {duesView === "sale"
            ? "What customers owe you — sales minus received."
            : "What you owe suppliers — purchases minus paid."}
        </div>
      )}
      <div className="mt-3 flex gap-1.5">
        {(
          [
            ["combined", "Total"],
            ["sale", "Customers"],
            ["purchase", "Suppliers"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setDuesView(v)}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5 text-xs font-bold",
              duesView === v ? "bg-amber-400 text-stone-900" : "bg-white/10 text-stone-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
