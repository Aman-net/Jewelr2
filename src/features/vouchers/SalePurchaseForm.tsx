import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Chip } from "../../components/ui/Bits.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { AmountInput, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { FlowHeader, StickyCta, type FlowTone } from "../../components/ui/Flow.tsx";
import { useLeaveGuard } from "../../hooks/useLeaveGuard.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { SHOP_ID } from "../../data/db.ts";
import { checkShortSale, getItemCfg, getLastRate, postVoucher, setLastRate } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import { fineToCash, GOLD_QUOTE_MG, SILVER_QUOTE_MG } from "../../domain/numeric/metalValue.ts";
import { lineFineMg } from "../../domain/rules/tunch.ts";
import { roundMetalMg } from "../../domain/numeric/rounding.ts";
import { labourPerKg, labourPerPiece } from "../../domain/numeric/labour.ts";
import type { BalanceDelta, LabourMode, MetalType, PricingMode, Voucher } from "../../domain/index.ts";
import type { StockBucket } from "../../data/index.ts";
import { usePartyList, useStockLive } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import Decimal from "decimal.js";
import { formatGram, formatINR, parseGramsToMg, parsePercentToScaled, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
import { uuid } from "../../lib/uuid.ts";
import { CategoryField } from "./CategoryField.tsx";
import { PartyPicker } from "./fields.tsx";
import { Review } from "./Review.tsx";

interface LineForm {
  metal: MetalType;
  category: string;
  itemCount: string;
  physicalG: string;
  recordedTunch: string;
  agreedTunch: string;
  mode: PricingMode;
  rate: string;
  labourMode: LabourMode | "";
  labourRate: string;
}

interface MiscForm {
  label: string;
  amount: string;
}

interface HeaderForm {
  partyId: string;
  businessDate: string;
  referenceNumber: string;
  notes: string;
}

export interface SalePrefill {
  partyId?: string;
  businessDate?: string;
  lines?: Partial<LineForm>[];
  misc?: Partial<MiscForm>[];
  correctedFrom?: string;
}

const TUNCH_SHORTCUTS = ["70", "75", "80", "85", "91.6", "100"];

const emptyLine = (): LineForm => ({
  metal: "SILVER", category: "", itemCount: "", physicalG: "", recordedTunch: "", agreedTunch: "", mode: "METAL_OPEN", rate: "", labourMode: "", labourRate: "",
});

const emptyMisc = (): MiscForm => ({ label: "", amount: "" });

/** Labour preview for a form line; 0 when unset. */
function lineLabour(l: LineForm): number {
  try {
    if (!l.labourMode || !l.labourRate.trim()) return 0;
    const rate = parseRupeesToPaise(l.labourRate);
    if (l.labourMode === "PER_PIECE") {
      const count = Number(l.itemCount);
      if (!count || count <= 0) return 0;
      return labourPerPiece(count, rate);
    }
    return labourPerKg(roundMetalMg(parseGramsToMg(l.physicalG), l.metal), rate);
  } catch {
    return 0;
  }
}

function lineHint(l: LineForm, kind: "SALE" | "PURCHASE"): string | null {
  try {
    const physicalMg = parseGramsToMg(l.physicalG);
    if (physicalMg <= 0 || !l.agreedTunch.trim()) return null;
    const fine = lineFineMg(physicalMg, parsePercentToScaled(l.agreedTunch), l.metal);
    const who = kind === "SALE" ? "Party owes" : "You owe";
    const labour = lineLabour(l);
    if (l.mode === "METAL_OPEN") {
      return labour > 0 ? `${who} fine ${formatGram(fine)} + ${formatINR(labour)} labour` : `${who} fine ${formatGram(fine)}`;
    }
    if (!l.rate.trim()) return `${who} fine ${formatGram(fine)} · enter rate`;
    const value = fineToCash(fine, parseRupeesToPaise(l.rate), l.metal === "GOLD" ? GOLD_QUOTE_MG : SILVER_QUOTE_MG);
    return `${who} ${formatINR(value + labour)}`;
  } catch {
    return null;
  }
}

export function SalePurchaseForm({ kind }: { kind: "SALE" | "PURCHASE" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const prefill = (location.state as { prefill?: SalePrefill } | null)?.prefill;
  const [voucherId] = useState(() => uuid());
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Voucher | null>(null);
  const [posted, setPosted] = useState<{ deltas: BalanceDelta; partyId: string } | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [posting, setPosting] = useState(false);
  const [lastRates, setLastRates] = useState<Record<string, { amountPaise: number }>>({});

  const { register, control, handleSubmit, setValue, watch, getValues, trigger, formState: { isDirty } } = useForm<HeaderForm & { lines: LineForm[]; misc: MiscForm[] }>({
    defaultValues: {
      partyId: prefill?.partyId ?? params.get("party") ?? "",
      businessDate: prefill?.businessDate ?? todayLocal(),
      referenceNumber: "",
      notes: prefill?.correctedFrom ? `Corrects ${prefill.correctedFrom}` : "",
      lines: prefill?.lines?.map((l) => ({ ...emptyLine(), ...l })) ?? [emptyLine()],
      misc: prefill?.misc?.map((m) => ({ ...emptyMisc(), ...m })) ?? [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const miscFields = useFieldArray({ control, name: "misc" });
  const partyId = watch("partyId");
  const partyList = usePartyList();
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";
  const backTo = prefill?.partyId ?? params.get("party") ? `/parties/${prefill?.partyId ?? params.get("party")}` : "/vouchers/new";
  /**
   * Back walks the wizard, not the app: on the details or review step a press
   * steps up one step (no "leave?" sheet, nothing typed is thrown away); on the
   * party step it leaves, and only asks when there is something to lose.
   */
  const { prompt } = useLeaveGuard((step > 0 || isDirty) && !posted, step > 0 ? () => setStep(step - 1) : undefined);
  const stockRows = useStockLive();
  const stockMap = useMemo(
    () => new Map((stockRows ?? []).map((b) => [`${b.metal}|${b.name.trim().toLowerCase()}`, b] as const)),
    [stockRows],
  );
  const stockOf = (metal: MetalType, name: string): StockBucket | undefined =>
    name.trim() ? stockMap.get(`${metal}|${name.trim().toLowerCase()}`) : undefined;

  /**
   * Item pick: set the name, prefill the item's default tunch when empty, and
   * (on sales) the item's saved selling labour so the line starts correct.
   */
  const pickItem = (index: number, metal: MetalType, name: string) => {
    setValue(`lines.${index}.category`, name);
    void getItemCfg(metal, name).then((cfg) => {
      const tunchKey = `lines.${index}.agreedTunch` as const;
      if (cfg.defaultTunchScaled !== undefined && !getValues(tunchKey)?.trim()) {
        setValue(tunchKey, new Decimal(cfg.defaultTunchScaled).div(100).toString());
      }
      if (kind === "SALE" && cfg.sellingLabourMode !== undefined && cfg.sellingLabourRatePaise !== undefined) {
        setValue(`lines.${index}.labourMode`, cfg.sellingLabourMode);
        setValue(`lines.${index}.labourRate`, new Decimal(cfg.sellingLabourRatePaise).div(100).toString());
      }
    });
  };

  /** Warn-only shorts for SALE review — posting stays allowed. */
  const shorts = useMemo(
    () =>
      kind === "SALE" && preview && stockRows
        ? checkShortSale(
            preview.lines.map((l) => ({ metalType: l.metalType, categoryName: l.categoryName, physicalMg: l.physicalMg })),
            stockRows,
          )
        : [],
    [kind, preview, stockRows],
  );

  useEffect(() => {
    void Promise.all([getLastRate("GOLD"), getLastRate("SILVER")]).then(([g, s]) => {
      const r: Record<string, { amountPaise: number }> = {};
      if (g) r.GOLD = { amountPaise: g.amountPaise };
      if (s) r.SILVER = { amountPaise: s.amountPaise };
      setLastRates(r);
    });
  }, []);

  const nextFromParty = async () => {
    setReviewError("");
    if (!partyId) {
      setReviewError("Choose the party first — whose khata is this?");
      return;
    }
    const role = (partyList ?? []).find((p) => p.id === partyId);
    if (kind === "SALE" && role && !role.isCustomer) {
      setReviewError(`${role.name} is not a customer — sales are disabled here.`);
      return;
    }
    if (kind === "PURCHASE" && role && !role.isSupplier) {
      setReviewError(`${role.name} is not a supplier — purchases are disabled here.`);
      return;
    }
    setStep(1);
  };

  const onReview = handleSubmit((v) => {
    setReviewError("");
    try {
      if (v.lines.length === 0) throw new Error("Add at least one line");
      const built = buildVoucher({
        id: voucherId,
        shopId: SHOP_ID,
        type: kind,
        partyId: v.partyId,
        businessDate: v.businessDate,
        referenceNumber: v.referenceNumber.trim() || undefined,
        notes: v.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        lines: v.lines.map((l, i) => {
          if (!l.category.trim()) throw new Error(`Line ${i + 1}: item name is required`);
          const physicalMg = parseGramsToMg(l.physicalG);
          if (physicalMg <= 0) throw new Error(`Line ${i + 1}: weight must be positive`);
          const agreedTunchScaled = parsePercentToScaled(l.agreedTunch);
          const recorded = l.recordedTunch.trim();
          const labour = l.labourMode ? l.labourRate.trim() : "";
          if (l.labourMode === "PER_PIECE" && !l.itemCount.trim()) {
            throw new Error(`Line ${i + 1}: pieces required for per-piece labour`);
          }
          return {
            metalType: l.metal,
            categoryName: l.category.trim(),
            itemCount: l.itemCount.trim() ? Number(l.itemCount) : undefined,
            physicalMg,
            recordedTunchScaled: recorded ? parsePercentToScaled(recorded) : undefined,
            agreedTunchScaled,
            pricingMode: l.mode,
            rateAmountPaise: l.mode === "CASH_AT_RATE" ? parseRupeesToPaise(l.rate) : undefined,
            rateUnit: l.mode === "CASH_AT_RATE" ? (l.metal === "GOLD" ? "GOLD_PER_10G" : "SILVER_PER_KG") : undefined,
            labourMode: l.labourMode || undefined,
            labourRatePaise: labour ? parseRupeesToPaise(labour) : undefined,
            notes: undefined,
          };
        }),
        misc: v.misc
          .filter((m) => m.label.trim() || m.amount.trim())
          .map((m, i) => {
            if (!m.label.trim()) throw new Error(`Charge ${i + 1}: label is required`);
            // Signed: negative amount = discount/kamayi.
            return { label: m.label.trim(), cashPaise: parseRupeesToPaise(m.amount, true) };
          }),
      });
      setPreview(built);
      setStep(2);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Invalid entry");
    }
  });

  const onConfirm = async () => {
    if (!preview) return;
    setPosting(true);
    setReviewError("");
    try {
      await postVoucher({
        id: voucherId,
        type: kind,
        partyId: preview.partyId,
        businessDate: preview.businessDate,
        referenceNumber: preview.referenceNumber,
        notes: preview.notes,
        lines: preview.lines.map((l) => ({
          metalType: l.metalType,
          categoryName: l.categoryName,
          itemCount: l.itemCount,
          physicalMg: l.physicalMg,
          recordedTunchScaled: l.recordedTunchScaled,
          agreedTunchScaled: l.agreedTunchScaled,
          pricingMode: l.pricingMode,
          rateAmountPaise: l.rateAmountPaise,
          rateUnit: l.rateUnit,
          labourMode: l.labourMode,
          labourRatePaise: l.labourRatePaise,
        })),
        misc: preview.misc.map((m) => ({ label: m.label, cashPaise: m.cashPaise })),
      });
      for (const l of preview.lines) {
        if (l.pricingMode === "CASH_AT_RATE" && l.rateAmountPaise && l.rateUnit) {
          await setLastRate(l.metalType, { amountPaise: l.rateAmountPaise, unit: l.rateUnit });
        }
      }
      setPosted({ deltas: voucherDeltas(preview), partyId: preview.partyId });
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  const title = kind === "SALE" ? "Sell goods" : "Buy goods";
  const tone: FlowTone = kind === "SALE" ? "amber" : "sky";
  const shell = "mx-auto w-full max-w-xl px-4 pb-6 pt-4";

  if (posted) {
    const d = posted.deltas;
    return (
      <Page title={title}>
        <Card>
          <SuccessView
            title={kind === "SALE" ? "Sale recorded" : "Purchase recorded"}
            summary={
              <div className="flex flex-col gap-2">
                <div className="text-sm text-stone-500">{partyName}</div>
                <BalanceGrid cashPaise={d.cashPaise} goldFineMg={d.goldFineMg} silverFineMg={d.silverFineMg} />
              </div>
            }
            primary={{ label: "View khata", onClick: () => navigate(`/parties/${posted.partyId}`) }}
            secondary={{ label: "New entry", onClick: () => navigate("/vouchers/new") }}
          />
        </Card>
      </Page>
    );
  }

  if (step === 2 && preview) {
    const d = voucherDeltas(preview);
    return (
      <div className={shell}>
        <div className="flex flex-col gap-3">
          <FlowHeader tone={tone} title="Review entry" context={partyName} current={2} labels={["Party", "Goods", "Review"]} />
          {shorts.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <div className="font-bold">Short shelf — posting anyway (warn only)</div>
              {shorts.map((s) => (
                <div key={`${s.metal}|${s.name}`}>
                  {s.name}: needs {formatGram(s.needMg)}, shelf {formatGram(s.haveMg)}
                </div>
              ))}
            </div>
          )}
          <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
            partyName={partyName} posting={posting} error={reviewError}
            onBack={() => { setPreview(null); setStep(1); }} onConfirm={onConfirm} />
          {prompt}
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <div className="flex flex-col gap-3">
        <FlowHeader
          tone={tone}
          title={title}
          backTo={backTo}
          backLabel={step > 0 ? "Party" : undefined}
          context={step === 1 ? (kind === "SALE" ? `Giving goods to ${partyName || "…"}` : `Taking goods from ${partyName || "…"}`) : undefined}
          onChangeContext={step === 1 ? () => setStep(0) : undefined}
          current={step}
          labels={["Party", "Goods", "Review"]}
        />
      {step === 0 && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void nextFromParty(); }}>
          <Card>
            <div className="flex flex-col gap-3">
              <div className="text-sm text-stone-500">{kind === "SALE" ? "Who is buying?" : "Who are you buying from?"}</div>
              <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id)} />
              <div className="grid grid-cols-2 gap-2">
                <Field label={en.voucher.date}>
                  <Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} />
                </Field>
                <Field label="Bill no. (optional)">
                  <Input {...register("referenceNumber")} placeholder="—" />
                </Field>
              </div>
            </div>
          </Card>
          {reviewError ? <p className="text-sm font-medium text-red-700">{reviewError}</p> : null}
          <StickyCta><Button type="submit" full className="min-h-14 text-lg shadow-lg">Continue →</Button></StickyCta>
        </form>
      )}
      {step === 1 && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
          {fields.map((f, i) => (
            <LineCard
              key={f.id}
              index={i}
              kind={kind}
              register={register}
              watch={watch}
              setValue={setValue}
              lastRate={lastRates[watch(`lines.${i}.metal`)]}
              stockOf={stockOf}
              onPickItem={(name) => pickItem(i, watch(`lines.${i}.metal`), name)}
              onRemove={fields.length > 1 ? () => remove(i) : undefined}
            />
          ))}
          <Button variant="secondary" type="button" onClick={() => { append(emptyLine()); void trigger(); }}>+ Add item</Button>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-stone-900">Extra charges (optional)</span>
              <button type="button" className="text-sm font-medium text-amber-800" onClick={() => miscFields.append(emptyMisc())}>+ Add</button>
            </div>
            {miscFields.fields.length === 0 && (
              <p className="text-xs text-stone-500">Packing, transport… added to the cash due. Use a − amount for a discount.</p>
            )}
            <div className="flex flex-col gap-2">
              {miscFields.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[1fr_110px_auto] items-end gap-2">
                  <Field label={i === 0 ? "Label" : ""}>
                    <Input {...register(`misc.${i}.label`)} placeholder="e.g. Packing" />
                  </Field>
                  <Field label={i === 0 ? "₹" : ""}>
                    <Input {...register(`misc.${i}.amount`)} inputMode="decimal" placeholder="0.00 (− = discount)" />
                  </Field>
                  <button type="button" className="pb-2.5 text-sm font-medium text-red-700" onClick={() => miscFields.remove(i)}>✕</button>
                </div>
              ))}
            </div>
          </Card>
          <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">{en.more}</summary>
            <div className="pt-3">
              <Field label="Notes (optional)">
                <Textarea {...register("notes")} rows={2} />
              </Field>
            </div>
          </details>
          {reviewError ? <p className="text-sm font-medium text-red-700">{reviewError}</p> : null}
          <StickyCta><Button type="submit" full className="min-h-14 text-lg shadow-lg">{en.voucher.review} →</Button></StickyCta>
        </form>
      )}
      {prompt}
    </div>
  </div>
  );
}

/** Shelf readout under the item picker. Warn-only on sales — never blocks. */
function ShelfHint({ kind, metal, category, enteredG, stockOf }: {
  kind: "SALE" | "PURCHASE";
  metal: MetalType;
  category: string;
  enteredG: string;
  stockOf: (metal: MetalType, name: string) => StockBucket | undefined;
}) {
  if (!category.trim()) return null;
  const have = stockOf(metal, category);
  if (!have) {
    return kind === "SALE"
      ? <div className="text-xs text-stone-500">Shelf: none yet — first sale posts anyway (warn only).</div>
      : null;
  }
  let short = false;
  try {
    short = kind === "SALE" && enteredG.trim() !== "" && parseGramsToMg(enteredG) > have.physicalMg;
  } catch {
    short = false;
  }
  return (
    <div className="text-xs text-stone-500">
      Shelf: {formatGram(have.physicalMg)}{have.pcs !== null ? ` (${have.pcs} pcs)` : ""}
      {short ? <span className="font-semibold text-amber-700"> · short — posts anyway</span> : null}
    </div>
  );
}

function LineCard({ index, kind, register, watch, setValue, lastRate, stockOf, onPickItem, onRemove }: {
  index: number;
  kind: "SALE" | "PURCHASE";
  register: UseFormRegister<HeaderForm & { lines: LineForm[]; misc: MiscForm[] }>;
  watch: UseFormWatch<HeaderForm & { lines: LineForm[]; misc: MiscForm[] }>;
  setValue: UseFormSetValue<HeaderForm & { lines: LineForm[]; misc: MiscForm[] }>;
  lastRate: { amountPaise: number } | undefined;
  stockOf: (metal: MetalType, name: string) => StockBucket | undefined;
  onPickItem: (name: string) => void;
  onRemove?: () => void;
}) {
  const metal = watch(`lines.${index}.metal`);
  const mode = watch(`lines.${index}.mode`);
  const agreed = watch(`lines.${index}.agreedTunch`);
  const labourMode = watch(`lines.${index}.labourMode`);
  const line = watch(`lines.${index}`);
  const hint = lineHint(line, kind);
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-900">Item {index + 1}</span>
        {onRemove ? <button type="button" className="text-sm font-medium text-red-700" onClick={onRemove}>Remove</button> : null}
      </div>
      <div className="flex flex-col gap-3">
        <Segmented
          options={["GOLD", "SILVER"] as const}
          value={metal}
          onChange={(m) => setValue(`lines.${index}.metal`, m)}
          labels={{
            GOLD: <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Gold</span>,
            SILVER: <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Silver</span>,
          }}
        />
        <CategoryField metal={metal} value={watch(`lines.${index}.category`)} onPick={onPickItem} />
        <ShelfHint kind={kind} metal={metal} category={watch(`lines.${index}.category`)} enteredG={line.physicalG} stockOf={stockOf} />
        <Field label="Weight" unit={en.units.g}>
          <AmountInput prefix="g" {...register(`lines.${index}.physicalG`)} inputMode="decimal" placeholder="0.000" />
        </Field>
        <Field label="Billing tunch" unit={en.units.percent}>
          <div className="flex flex-wrap gap-1.5">
            {TUNCH_SHORTCUTS.map((t) => (
              <Chip key={t} selected={agreed === t} onClick={() => setValue(`lines.${index}.agreedTunch`, t)}>
                {t}
              </Chip>
            ))}
          </div>
          <Input {...register(`lines.${index}.agreedTunch`)} inputMode="decimal" placeholder="Or type exact %" className="mt-2" />
        </Field>
        <Segmented
          options={["METAL_OPEN", "CASH_AT_RATE"] as const}
          value={mode}
          onChange={(m) => setValue(`lines.${index}.mode`, m)}
          labels={{ METAL_OPEN: "Owes metal", CASH_AT_RATE: "Cash now" }}
        />
        {mode === "CASH_AT_RATE" && (
          <Field
            label={en.voucher.rate}
            unit={metal === "GOLD" ? en.units.per10g : en.units.perKg}
            hint={lastRate ? `${en.voucher.lastUsedRate}: ${formatINR(lastRate.amountPaise)} — tap field to reuse` : undefined}
          >
            <AmountInput
              prefix="₹"
              {...register(`lines.${index}.rate`)}
              inputMode="decimal"
              placeholder={lastRate ? formatINR(lastRate.amountPaise) : "0.00"}
              onFocus={(e) => {
                if (!e.target.value && lastRate) setValue(`lines.${index}.rate`, String(lastRate.amountPaise / 100));
              }}
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Pieces">
            <Input {...register(`lines.${index}.itemCount`)} inputMode="numeric" placeholder={labourMode === "PER_PIECE" ? "required" : "—"} />
          </Field>
          <Field label="Tested tunch (optional)" unit={en.units.percent}>
            <Input {...register(`lines.${index}.recordedTunch`)} inputMode="decimal" placeholder="—" />
          </Field>
        </div>
        <Field label="Labour (optional)">
          <Segmented
            options={["", "PER_PIECE", "PER_KG"] as const}
            value={labourMode}
            onChange={(m) => setValue(`lines.${index}.labourMode`, m)}
            labels={{ "": "None", PER_PIECE: "Per piece", PER_KG: "Per kg" }}
          />
        </Field>
        {labourMode && (
          <Field label="Labour rate" unit={labourMode === "PER_PIECE" ? "₹/pc" : "₹/kg"}>
            <AmountInput prefix="₹" {...register(`lines.${index}.labourRate`)} inputMode="decimal" placeholder="0.00" />
          </Field>
        )}
        {hint ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-900">{hint}</div> : null}
      </div>
    </Card>
  );
}
