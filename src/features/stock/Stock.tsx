import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { Button } from "../../components/ui/Button.tsx";
import { Sheet } from "../../components/ui/Bits.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { AmountInput, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { LoadingRow } from "../../components/ui/Loader.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { MetalTag } from "../../components/ui/TypeTag.tsx";
import { PartyAvatar } from "../../components/ui/PartyAvatar.tsx";
import {
  adjustStock,
  getItemCfg,
  getStock,
  getStockMoves,
  isLowStock,
  seedStock,
  setItemCfg,
} from "../../data/index.ts";
import type { MetalType } from "../../domain/index.ts";
import type { ItemCfg, StockBucket } from "../../data/index.ts";
import { dayLabel, formatGram, parseGramsToMg, parsePercentToScaled, todayLocal } from "../../lib/format.ts";
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
          <PartyAvatar name="Stock" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-stone-900">Stock</div>
            <div className="text-xs text-stone-500">
              {summary === undefined
                ? "Loading…"
                : summary.count === 0
                  ? "Seed your opening count to begin"
                  : `${summary.count} items${summary.low > 0 ? ` · ${summary.low} low` : ""}`}
            </div>
          </div>
          <span className="text-lg text-stone-400">›</span>
        </div>
      </Card>
    </Link>
  );
}

const TRADE_WORDS: Record<string, string> = { SALE: "Sale", PURCHASE: "Purchase", REVERSAL: "Reversal" };

function BucketCard({ bucket }: { bucket: StockBucket }) {
  const [open, setOpen] = useState(false);
  const cfg = useLiveQuery(() => getItemCfg(bucket.metal, bucket.name), [bucket.metal, bucket.name]);
  const moves = useLiveQuery(
    () => (open ? getStockMoves(bucket.metal, bucket.name) : Promise.resolve([])),
    [open, bucket.metal, bucket.name],
  );
  const low = cfg !== undefined && isLowStock(bucket, cfg);
  return (
    <>
      <button type="button" className="w-full text-left" onClick={() => setOpen(true)}>
        <Card>
          <div className="flex items-center gap-3">
            <MetalTag metal={bucket.metal} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-stone-900">{bucket.name}</div>
              <div className="text-xs text-stone-500">
                {formatGram(bucket.physicalMg)}{bucket.pcs !== null ? ` · ${bucket.pcs} pcs` : ""} · {formatGram(bucket.fineMg)} fine
              </div>
            </div>
            {low ? (
              <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-800">LOW</span>
            ) : null}
          </div>
        </Card>
      </button>
      {open && (
        <Sheet title={`${bucket.name} · stock`} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-stone-50 px-2 py-2 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Shelf weight</div>
                <div className="text-sm font-bold text-stone-900">{formatGram(bucket.physicalMg)}</div>
              </div>
              <div className="rounded-xl bg-stone-50 px-2 py-2 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Pieces</div>
                <div className="text-sm font-bold text-stone-900">{bucket.pcs !== null ? bucket.pcs : "—"}</div>
              </div>
              <div className="rounded-xl bg-stone-50 px-2 py-2 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  <MetalTag metal={bucket.metal} />
                </div>
                <div className="text-sm font-bold text-stone-900">{formatGram(bucket.fineMg)} fine</div>
              </div>
            </div>
            <ItemCfgForm metal={bucket.metal} name={bucket.name} />
            <div className="text-sm font-semibold text-stone-700">Movements</div>
            {(moves ?? []).length === 0 && <p className="text-sm text-stone-500">No movements yet.</p>}
            {(moves ?? []).map((m) => (
              <div key={m.id} className="flex items-start justify-between gap-2 border-b border-stone-100 py-2 last:border-0">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900">
                    {m.reason ?? (m.voucherType ? (TRADE_WORDS[m.voucherType] ?? m.voucherType) : "Movement")}
                  </div>
                  <div className="text-xs text-stone-500">
                    {dayLabel(m.businessDate)}
                    {m.voucherId ? <> · <Link to={`/vouchers/${m.voucherId}`} className="font-medium text-amber-800">record ›</Link></> : null}
                  </div>
                </div>
                <div className={cn("shrink-0 text-sm font-bold tabular-nums", m.physicalDeltaMg >= 0 ? "text-emerald-700" : "text-red-700")}>
                  {m.physicalDeltaMg >= 0 ? "+" : "−"}{formatGram(Math.abs(m.physicalDeltaMg))}
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <div className="flex-1">
                <Link to={`/stock/move?mode=adjust&metal=${bucket.metal}&name=${encodeURIComponent(bucket.name)}`}>
                  <Button variant="secondary" full>Adjust</Button>
                </Link>
              </div>
              <div className="flex-1"><Button full onClick={() => setOpen(false)}>Done</Button></div>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}

/** Per-item defaults + low-stock levels. Master only — history untouched. */
export function ItemCfgForm({ metal, name }: { metal: MetalType; name: string }) {
  const cfg = useLiveQuery(() => getItemCfg(metal, name), [metal, name]);
  const [tunch, setTunch] = useState("");
  const [lowG, setLowG] = useState("");
  const [lowPcs, setLowPcs] = useState("");
  const [loaded, setLoaded] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  if (cfg !== undefined && loaded !== `${metal}|${name}`) {
    setLoaded(`${metal}|${name}`);
    setTunch(cfg.defaultTunchScaled !== undefined ? String(cfg.defaultTunchScaled / 100) : "");
    setLowG(cfg.lowMg !== undefined ? String(cfg.lowMg / 1000) : "");
    setLowPcs(cfg.lowPcs !== undefined ? String(cfg.lowPcs) : "");
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
      {error ? <p className="mt-1 text-xs font-medium text-red-700">{error}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <Button variant="secondary" onClick={() => void save()}>Save</Button>
        {saved ? <span className="text-xs font-medium text-emerald-700">Saved</span> : null}
      </div>
    </div>
  );
}

export function StockPage() {
  const stock = useLiveQuery(() => getStock(), []);
  return (
    <Page
      title="Stock"
      action={<Link to="/stock/move?mode=seed" className="text-sm font-medium text-amber-800">+ Seed</Link>}
    >
      <div className="flex gap-2">
        <div className="flex-1">
          <Link to="/stock/move?mode=seed"><Button variant="secondary" full>Seed count</Button></Link>
        </div>
        <div className="flex-1">
          <Link to="/stock/move?mode=adjust"><Button variant="secondary" full>Adjust</Button></Link>
        </div>
      </div>
      {stock === undefined && <LoadingRow label="Weighing stock…" />}
      {stock !== undefined && stock.length === 0 && (
        <Card><p className="text-sm text-stone-500">No stock yet. Seed your opening count, then sales and purchases move it automatically.</p></Card>
      )}
      {(stock ?? []).map((b) => <BucketCard key={`${b.metal}|${b.name.toLowerCase()}`} bucket={b} />)}
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
      navigate("/stock");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  });

  return (
    <Page title={mode === "seed" ? "Seed count" : "Adjust stock"} backTo="/stock" backLabel="Stock">
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
          {mode === "seed" ? "Seed stock" : `${direction === "ADD" ? "Add to" : "Remove from"} shelf`}
        </Button>
      </form>
    </Page>
  );
}
