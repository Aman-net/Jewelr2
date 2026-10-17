import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { Boxes } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { EmptyState } from "../../components/ui/Bits.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { AmountInput, Field, Input, SearchInput, Textarea } from "../../components/ui/Field.tsx";
import { LoadingRow } from "../../components/ui/Loader.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { MetalTag } from "../../components/ui/TypeTag.tsx";
import {
  adjustStock,
  getItemCfg,
  getStock,
  getStockMoves,
  isLowStock,
  seedStock,
  setItemCfg,
} from "../../data/index.ts";
import type { LabourMode, MetalType } from "../../domain/index.ts";
import type { ItemCfg, StockBucket, StockMove } from "../../data/index.ts";
import { dayLabel, formatGram, formatINR, parseGramsToMg, parsePercentToScaled, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";
import { CategoryField } from "../vouchers/CategoryField.tsx";

/** Home card: item count today. Low-stock lives on the stock screen. */
export function StockHomeCard() {
  const summary = useLiveQuery(async () => {
    const buckets = await getStock();
    let low = 0;
    for (const b of buckets) {
      if (isLowStock(b, await getItemCfg(b.metal, b.name))) low += 1;
    }
    return { count: buckets.length, low };
  }, []);
  return (
    <Link to="/stock">
      <Card>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <Boxes size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-stone-900">Stock</div>
            <div className="text-xs text-stone-500">
              {summary === undefined
                ? "Loading…"
                : summary.count === 0
                  ? "Seed your opening count to begin"
                  : `${summary.count} items${summary.low > 0 ? ` · ${summary.low} low` : ""}`}
            </div>
          </div>
          <span className="shrink-0 text-lg font-bold text-stone-300">›</span>
        </div>
      </Card>
    </Link>
  );
}

const TRADE_WORDS: Record<string, string> = { SALE: "Sale", PURCHASE: "Purchase", REVERSAL: "Reversal" };

/** Human label for one stock movement row. */
function movementLabel(m: StockMove): string {
  return m.reason ?? (m.voucherType ? (TRADE_WORDS[m.voucherType] ?? m.voucherType) : "Movement");
}

/** Labour carried by a movement's source line, e.g. "Labour 3 pcs × ₹50.00 = ₹150.00". */
function movementLabour(m: StockMove): string | null {
  const paise = m.labourPaise ?? 0;
  if (paise <= 0) return null;
  const rate = formatINR(m.labourRatePaise ?? 0);
  const basis =
    m.labourMode === "PER_PIECE"
      ? `${Math.abs(m.pcsDelta)} pcs × ${rate}`
      : `${formatGram(Math.abs(m.physicalDeltaMg))} × ${rate}/kg`;
  return `Labour ${basis} = ${formatINR(paise)}`;
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2 text-center">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</div>
      <div className="text-sm font-bold tabular-nums text-stone-900">{value}</div>
    </div>
  );
}

const itemLink = (metal: string, name: string) => `/stock/item?metal=${metal}&name=${encodeURIComponent(name)}`;

/** One tappable item row. Detail lives on the item page, not a cramped sheet. */
function BucketRow({ bucket }: { bucket: StockBucket }) {
  const cfg = useLiveQuery(() => getItemCfg(bucket.metal, bucket.name), [bucket.metal, bucket.name]);
  const low = cfg !== undefined && isLowStock(bucket, cfg);
  return (
    <Link
      to={itemLink(bucket.metal, bucket.name)}
      className="flex items-center gap-3 border-b border-stone-100 py-2.5 last:border-0 active:bg-stone-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-stone-900">{bucket.name}</span>
          {low ? (
            <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">LOW</span>
          ) : null}
        </div>
        <div className="text-xs tabular-nums text-stone-500">
          {formatGram(bucket.physicalMg)}
          {bucket.pcs !== null ? ` · ${bucket.pcs} pcs` : ""} · {formatGram(bucket.fineMg)} fine
        </div>
      </div>
      <span className="text-lg text-stone-400">›</span>
    </Link>
  );
}

/** One metal's items in a single card with a count/weight header. */
function MetalGroupCard({ metal, buckets, low }: { metal: "GOLD" | "SILVER"; buckets: StockBucket[]; low: Set<string> }) {
  const totalMg = buckets.reduce((s, b) => s + b.physicalMg, 0);
  const anyPcs = buckets.some((b) => b.pcs !== null);
  const totalPcs = buckets.reduce((s, b) => s + (b.pcs ?? 0), 0);
  return (
    <Card>
      <div className="mb-1 flex items-center gap-2 border-b border-stone-100 pb-2">
        <MetalTag metal={metal} />
        <span className="text-xs text-stone-500">{buckets.length} item{buckets.length === 1 ? "" : "s"}</span>
        {low.size > 0 ? (
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">{low.size} low</span>
        ) : null}
        <span className="ml-auto text-sm font-semibold tabular-nums text-stone-900">
          {formatGram(totalMg)}
          {anyPcs ? ` · ${totalPcs} pcs` : ""}
        </span>
      </div>
      {buckets.map((b) => (
        <BucketRow key={`${b.metal}|${b.name.toLowerCase()}`} bucket={b} />
      ))}
    </Card>
  );
}

function StockSummaryCard({ gold, silver }: { gold: StockBucket[]; silver: StockBucket[] }) {
  const goldMg = gold.reduce((s, b) => s + b.physicalMg, 0);
  const silverMg = silver.reduce((s, b) => s + b.physicalMg, 0);
  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-amber-50 px-3 py-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />Gold · {gold.length}
          </div>
          <div className="text-sm font-bold tabular-nums text-stone-900">{formatGram(goldMg)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />Silver · {silver.length}
          </div>
          <div className="text-sm font-bold tabular-nums text-stone-900">{formatGram(silverMg)}</div>
        </div>
      </div>
    </Card>
  );
}

/** Per-item defaults + low-stock levels. Master only — history untouched. */
export function ItemCfgForm({ metal, name }: { metal: MetalType; name: string }) {
  const cfg = useLiveQuery(() => getItemCfg(metal, name), [metal, name]);
  const [tunch, setTunch] = useState("");
  const [lowG, setLowG] = useState("");
  const [lowPcs, setLowPcs] = useState("");
  const [sellMode, setSellMode] = useState<"" | LabourMode>("");
  const [sellRate, setSellRate] = useState("");
  const [loaded, setLoaded] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  if (cfg !== undefined && loaded !== `${metal}|${name}`) {
    setLoaded(`${metal}|${name}`);
    setTunch(cfg.defaultTunchScaled !== undefined ? String(cfg.defaultTunchScaled / 100) : "");
    setLowG(cfg.lowMg !== undefined ? String(cfg.lowMg / 1000) : "");
    setLowPcs(cfg.lowPcs !== undefined ? String(cfg.lowPcs) : "");
    setSellMode(cfg.sellingLabourMode ?? "");
    setSellRate(cfg.sellingLabourRatePaise !== undefined ? String(cfg.sellingLabourRatePaise / 100) : "");
    setSaved(false);
  }
  const save = async () => {
    setError("");
    setSaved(false);
    try {
      const patch: ItemCfg = {};
      if (tunch.trim()) patch.defaultTunchScaled = parsePercentToScaled(tunch);
      else (patch as Record<string, unknown>).defaultTunchScaled = undefined;
      if (lowG.trim()) patch.lowMg = parseGramsToMg(lowG);
      else (patch as Record<string, unknown>).lowMg = undefined;
      if (lowPcs.trim()) {
        const n = Number(lowPcs);
        if (!Number.isInteger(n) || n < 0) throw new Error("Low pieces must be a whole number");
        patch.lowPcs = n;
      } else (patch as Record<string, unknown>).lowPcs = undefined;
      if (sellMode) {
        const rate = sellRate.trim() ? parseRupeesToPaise(sellRate) : 0;
        if (rate <= 0) throw new Error("Selling labour rate must be more than zero");
        patch.sellingLabourMode = sellMode;
        patch.sellingLabourRatePaise = rate;
      } else {
        (patch as Record<string, unknown>).sellingLabourMode = undefined;
        (patch as Record<string, unknown>).sellingLabourRatePaise = undefined;
      }
      await setItemCfg(metal, name, patch);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };
  if (cfg === undefined) return <LoadingRow label="Loading item settings…" />;
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Defaults & low-stock alert</div>
      <p className="mb-2 text-xs text-stone-500">Prefills tunch on sale entries; flags LOW here when stock falls below.</p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Tunch %">
          <Input value={tunch} onChange={(e) => setTunch(e.target.value)} inputMode="decimal" placeholder="—" />
        </Field>
        <Field label="Low g">
          <Input value={lowG} onChange={(e) => setLowG(e.target.value)} inputMode="decimal" placeholder="—" />
        </Field>
        <Field label="Low pcs">
          <Input value={lowPcs} onChange={(e) => setLowPcs(e.target.value)} inputMode="numeric" placeholder="—" />
        </Field>
      </div>
      <div className="mt-3 border-t border-stone-200 pt-3">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-stone-500">Selling labour (auto-fills on sale)</div>
        <p className="mb-2 text-xs text-stone-500">Save the labour this item is sold at — a sale line picks it up automatically.</p>
        <Segmented
          options={["", "PER_PIECE", "PER_KG"] as const}
          value={sellMode}
          onChange={(m) => { setSellMode(m); setSaved(false); }}
          labels={{ "": "None", PER_PIECE: "Per piece", PER_KG: "Per kg" }}
        />
        {sellMode ? (
          <div className="mt-2">
            <Field label="Rate" unit={sellMode === "PER_PIECE" ? "₹/pc" : "₹/kg"}>
              <AmountInput prefix="₹" value={sellRate} onChange={(e) => { setSellRate(e.target.value); setSaved(false); }} inputMode="decimal" placeholder="0.00" />
            </Field>
          </div>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-red-700">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" onClick={() => void save()}>Save</Button>
        {saved ? <span className="text-xs font-medium text-emerald-700">Saved</span> : null}
      </div>
    </div>
  );
}

export function StockPage() {
  const data = useLiveQuery(async () => {
    const buckets = await getStock();
    const lowKeys = new Set<string>();
    let low = 0;
    for (const b of buckets) {
      if (isLowStock(b, await getItemCfg(b.metal, b.name))) {
        low += 1;
        lowKeys.add(`${b.metal}|${b.name.toLowerCase()}`);
      }
    }
    return { buckets, low, lowKeys };
  }, []);
  const [query, setQuery] = useState("");
  const [metal, setMetal] = useState<"ALL" | "GOLD" | "SILVER">("ALL");
  const buckets = data?.buckets ?? [];
  const q = query.trim().toLowerCase();
  const filtered = buckets.filter(
    (b) => (metal === "ALL" || b.metal === metal) && (!q || b.name.toLowerCase().includes(q)),
  );
  const gold = filtered.filter((b) => b.metal === "GOLD");
  const silver = filtered.filter((b) => b.metal === "SILVER");
  const allGold = buckets.filter((b) => b.metal === "GOLD");
  const allSilver = buckets.filter((b) => b.metal === "SILVER");

  const lowFor = (list: StockBucket[]) => {
    const keys = data?.lowKeys;
    return new Set(keys ? list.filter((b) => keys.has(`${b.metal}|${b.name.toLowerCase()}`)).map((b) => b.name) : []);
  };

  return (
    <Page
      title="Stock"
      subtitle={data === undefined ? undefined : `${buckets.length} item${buckets.length === 1 ? "" : "s"}${data.low > 0 ? ` · ${data.low} low` : ""}`}
      action={<Link to="/stock/move?mode=seed" className="text-sm font-medium text-amber-800">+ Seed</Link>}
    >
      {data === undefined && <LoadingRow label="Weighing stock…" />}

      {data !== undefined && buckets.length === 0 && (
        <EmptyState
          title="No stock yet"
          hint="Seed your opening count once, then sales and purchases move it automatically."
          action={<Link to="/stock/move?mode=seed"><Button variant="secondary">Seed count</Button></Link>}
        />
      )}

      {data !== undefined && buckets.length > 0 && (
        <>
          <StockSummaryCard gold={allGold} silver={allSilver} />

          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items…"
            inputMode="search"
          />
          <Segmented
            options={["ALL", "GOLD", "SILVER"] as const}
            value={metal}
            onChange={setMetal}
            labels={{ ALL: "All", GOLD: "Gold", SILVER: "Silver" }}
          />

          {filtered.length === 0 && (
            <Card><p className="text-sm text-stone-500">No items match. Try another metal or spelling.</p></Card>
          )}
          {gold.length > 0 && <MetalGroupCard metal="GOLD" buckets={gold} low={lowFor(gold)} />}
          {silver.length > 0 && <MetalGroupCard metal="SILVER" buckets={silver} low={lowFor(silver)} />}

          <div className="flex gap-2">
            <div className="flex-1"><Link to="/stock/move?mode=seed"><Button variant="secondary" full>Seed count</Button></Link></div>
            <div className="flex-1"><Link to="/stock/move?mode=adjust"><Button variant="secondary" full>Adjust</Button></Link></div>
          </div>
        </>
      )}
    </Page>
  );
}

/** Dedicated item page — room to read the numbers, set defaults and trace movements. */
export function StockItemPage() {
  const [params] = useSearchParams();
  const name = (params.get("name") ?? "").trim();
  const metal: "GOLD" | "SILVER" = params.get("metal") === "GOLD" ? "GOLD" : "SILVER";
  const stock = useLiveQuery(() => getStock(), []);
  const cfg = useLiveQuery(() => getItemCfg(metal, name), [metal, name]);
  const moves = useLiveQuery(
    () => (name ? getStockMoves(metal, name) : Promise.resolve([] as StockMove[])),
    [metal, name],
  );
  const bucket = (stock ?? []).find((b) => b.metal === metal && b.name.trim().toLowerCase() === name.toLowerCase());
  const low = bucket !== undefined && cfg !== undefined && isLowStock(bucket, cfg);

  let running = 0;
  const rows = (moves ?? []).map((m) => ({ m, run: (running += m.physicalDeltaMg) }));
  const display = [...rows].reverse();

  if (!name) {
    return (
      <Page title="Stock item" backTo="/stock" backLabel="Stock">
        <Card><p className="text-sm text-stone-500">No item selected.</p></Card>
      </Page>
    );
  }
  if (stock !== undefined && !bucket) {
    return (
      <Page title={name} backTo="/stock" backLabel="Stock">
        <Card>
          <p className="text-sm text-stone-500">No stock history for this item — it may have been renamed or the link is stale.</p>
        </Card>
      </Page>
    );
  }

  return (
    <Page
      title={bucket?.name ?? name}
      subtitle={moves === undefined ? undefined : `${moves.length} movement${moves.length === 1 ? "" : "s"}`}
      backTo="/stock"
      backLabel="Stock"
    >
      {stock === undefined ? (
        <LoadingRow label="Loading item…" />
      ) : (
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <MetalTag metal={metal} />
            {low ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">LOW STOCK</span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatCell label="Shelf weight" value={formatGram(bucket?.physicalMg ?? 0)} />
            <StatCell label="Pieces" value={bucket?.pcs ?? "—"} />
            <StatCell label="Fine weight" value={formatGram(bucket?.fineMg ?? 0)} />
          </div>
          {cfg?.sellingLabourMode !== undefined && cfg.sellingLabourRatePaise !== undefined ? (
            <div className="mt-2 text-xs text-stone-500">
              Selling labour (auto-fills on sale): <span className="font-semibold text-stone-700">{formatINR(cfg.sellingLabourRatePaise)}</span>{" "}
              {cfg.sellingLabourMode === "PER_PIECE" ? "per piece" : "per kg"}
            </div>
          ) : null}
        </Card>
      )}

      <ItemCfgForm metal={metal} name={name} />

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">Movements</span>
          <span className="text-xs text-stone-400">newest first</span>
        </div>
        <p className="mb-2 text-xs text-stone-500">
          Sales and purchases move stock automatically. The small line shows shelf weight after each entry.
        </p>
        {moves === undefined && <LoadingRow label="Loading movements…" />}
        {moves !== undefined && moves.length === 0 && <p className="text-sm text-stone-500">No movements yet.</p>}
        {display.map(({ m, run }) => {
          const labour = movementLabour(m);
          return (
            <div key={m.id} className="border-b border-stone-100 py-2.5 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-stone-900">{movementLabel(m)}</div>
                  <div className="text-xs text-stone-500">
                    {dayLabel(m.businessDate)}
                    {m.voucherId ? (
                      <> · <Link to={`/vouchers/${m.voucherId}`} className="font-medium text-amber-800">record ›</Link></>
                    ) : null}
                  </div>
                  {labour ? <div className="text-[11px] tabular-nums text-stone-500">{labour}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  <div className={cn("text-sm font-bold tabular-nums", m.physicalDeltaMg >= 0 ? "text-emerald-700" : "text-red-700")}>
                    {m.physicalDeltaMg >= 0 ? "+" : "−"}{formatGram(Math.abs(m.physicalDeltaMg))}
                  </div>
                  <div className="text-[11px] tabular-nums text-stone-400">{formatGram(run)} in stock</div>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <Link to={`/stock/move?mode=adjust&metal=${metal}&name=${encodeURIComponent(bucket?.name ?? name)}`}>
        <Button full>Adjust stock</Button>
      </Link>
    </Page>
  );
}

interface MoveForm {
  metal: MetalType;
  name: string;
  weightG: string;
  pcs: string;
  tunch: string;
  businessDate: string;
  direction: "ADD" | "REMOVE";
  reason: string;
}

export function StockMovePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mode = params.get("mode") === "adjust" ? "adjust" : "seed";
  const itemName = (params.get("name") ?? "").trim();
  const itemMetal = params.get("metal");
  const fromItem = mode === "adjust" && itemName !== "" && (itemMetal === "GOLD" || itemMetal === "SILVER");
  const backTo = fromItem ? itemLink(itemMetal as string, itemName) : "/stock";
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MoveForm>({
    defaultValues: {
      metal: (params.get("metal") as MetalType) || "SILVER",
      name: params.get("name") ?? "",
      weightG: "",
      pcs: "",
      tunch: "100",
      businessDate: todayLocal(),
      direction: "ADD",
      reason: "",
    },
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const metal = watch("metal");
  const direction = watch("direction");

  const submit = handleSubmit(async (v) => {
    setError("");
    if (!v.name.trim()) {
      setError("Pick the item first.");
      return;
    }
    setBusy(true);
    try {
      const sign = mode === "seed" ? 1 : v.direction === "ADD" ? 1 : -1;
      const physicalMg = parseGramsToMg(v.weightG) * sign;
      const pcs = v.pcs.trim() ? Number(v.pcs) : undefined;
      if (pcs !== undefined && (!Number.isInteger(pcs) || pcs <= 0)) throw new Error("Pieces must be a whole number");
      const tunchScaled = parsePercentToScaled(v.tunch);
      if (mode === "seed") {
        await seedStock(
          [{ metal: v.metal, name: v.name.trim(), physicalMg: Math.abs(physicalMg), pcs, tunchScaled }],
          v.businessDate,
          v.reason.trim() || undefined,
        );
      } else {
        await adjustStock({
          metal: v.metal,
          name: v.name.trim(),
          physicalDeltaMg: physicalMg,
          pcsDelta: pcs !== undefined ? pcs * sign : undefined,
          tunchScaled,
          businessDate: v.businessDate,
          reason: v.reason,
        });
      }
      navigate(fromItem ? itemLink(v.metal, v.name.trim()) : "/stock");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  });

  return (
    <Page
      title={mode === "seed" ? "Seed count" : fromItem ? `Adjust · ${itemName}` : "Adjust stock"}
      backTo={backTo}
      backLabel={fromItem ? "Item" : "Stock"}
    >
      <form className="flex flex-col gap-3" onSubmit={(e) => { void submit(e); }}>
        <Card>
          <div className="flex flex-col gap-3">
            <Segmented
              options={["GOLD", "SILVER"] as const}
              value={metal}
              onChange={(m) => setValue("metal", m)}
              labels={{ GOLD: "Gold", SILVER: "Silver" }}
            />
            <CategoryField metal={metal} value={watch("name")} onPick={(n) => setValue("name", n)} />
            {errors.name ? <p className="text-xs text-red-700">Item is required</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Weight" unit="g">
                <AmountInput prefix="g" {...register("weightG", { required: true })} inputMode="decimal" placeholder="0.000" />
              </Field>
              <Field label="Pieces (optional)">
                <Input {...register("pcs")} inputMode="numeric" placeholder="—" />
              </Field>
            </div>
            <Field label="Purity (tunch)" unit="%">
              <Input {...register("tunch", { required: true })} inputMode="decimal" placeholder="100" />
            </Field>
            <Field label="Date">
              <Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} />
            </Field>
            {mode === "adjust" && (
              <Field label="Direction">
                <Segmented
                  options={["ADD", "REMOVE"] as const}
                  value={direction}
                  onChange={(d) => setValue("direction", d)}
                  labels={{ ADD: "Add to shelf", REMOVE: "Remove from shelf" }}
                />
              </Field>
            )}
            <Field label={mode === "adjust" ? "Reason (required)" : "Note (optional)"}>
              <Textarea {...register("reason", { required: mode === "adjust" })} rows={2} placeholder={mode === "adjust" ? "e.g. damage, found, re-weigh" : "e.g. Opening count Jan"} />
            </Field>
          </div>
        </Card>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <Button type="submit" full disabled={busy} className="min-h-14 text-lg shadow-lg">
          {mode === "seed" ? "Seed stock" : "Save adjustment"}
        </Button>
      </form>
    </Page>
  );
}
