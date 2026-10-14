import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Steps } from "../../components/ui/Bits.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { Chip } from "../../components/ui/Bits.tsx";
import { getLastRate, postVoucher, setLastRate } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import { fineToCash, GOLD_QUOTE_MG, SILVER_QUOTE_MG } from "../../domain/numeric/metalValue.ts";
import { fineFromPhysical } from "../../domain/numeric/tunch.ts";
import { labourOnPhysical } from "../../domain/numeric/labour.ts";
import type { BalanceDelta, MetalType, PricingMode, Voucher } from "../../domain/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
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
  labour: string;
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
  correctedFrom?: string;
}

const TUNCH_SHORTCUTS = ["70", "75", "80", "85", "91.6", "100"];

const emptyLine = (): LineForm => ({
  metal: "SILVER", category: "", itemCount: "", physicalG: "", recordedTunch: "", agreedTunch: "", mode: "METAL_OPEN", rate: "", labour: "",
});

function lineHint(l: LineForm, kind: "SALE" | "PURCHASE"): string | null {
  try {
    const physicalMg = parseGramsToMg(l.physicalG);
    if (physicalMg <= 0 || !l.agreedTunch.trim()) return null;
    const fine = fineFromPhysical(physicalMg, parsePercentToScaled(l.agreedTunch));
    const who = kind === "SALE" ? "Party owes" : "You owe";
    if (l.mode === "METAL_OPEN") return `${who} fine ${formatGram(fine)}`;
    if (!l.rate.trim()) return `${who} fine ${formatGram(fine)} · enter rate`;
    const value = fineToCash(fine, parseRupeesToPaise(l.rate), l.metal === "GOLD" ? GOLD_QUOTE_MG : SILVER_QUOTE_MG);
    const labour = l.labour.trim() && kind === "SALE" ? labourOnPhysical(physicalMg, parseRupeesToPaise(l.labour)) : 0;
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

  const { register, control, handleSubmit, setValue, watch, trigger } = useForm<HeaderForm & { lines: LineForm[] }>({
    defaultValues: {
      partyId: prefill?.partyId ?? params.get("party") ?? "",
      businessDate: prefill?.businessDate ?? todayLocal(),
      referenceNumber: "",
      notes: prefill?.correctedFrom ? `Corrects ${prefill.correctedFrom}` : "",
      lines: prefill?.lines?.map((l) => ({ ...emptyLine(), ...l })) ?? [emptyLine()],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const partyId = watch("partyId");
  const partyList = usePartyList();
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";

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
    setStep(1);
  };

  const onReview = handleSubmit((v) => {
    setReviewError("");
    try {
      if (v.lines.length === 0) throw new Error("Add at least one line");
      const built = buildVoucher({
        id: voucherId,
        shopId: "shop-local-1",
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
            labourPaisePerGram: l.labour.trim() ? parseRupeesToPaise(l.labour) : undefined,
            notes: undefined,
          };
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
          labourPaisePerGram: l.labourPaisePerGram,
        })),
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

  if (posted) {
    const d = posted.deltas;
    return (
      <Page title={title}>
        <Card>
          <SuccessView
            title={kind === "SALE" ? "Sale recorded" : "Purchase recorded"}
            summary={
              <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                {partyName} · {d.cashPaise !== 0 && <>{formatINR(d.cashPaise)} </>}
                {d.goldFineMg !== 0 && <>gold {formatGram(d.goldFineMg)} </>}
                {d.silverFineMg !== 0 && <>silver {formatGram(d.silverFineMg)}</>}
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
      <Page title={en.voucher.review}>
        <Steps current={2} labels={["Party", "Goods", "Review"]} />
        <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
          partyName={partyName} posting={posting} error={reviewError}
          onBack={() => { setPreview(null); setStep(1); }} onConfirm={onConfirm} />
      </Page>
    );
  }

  return (
    <Page title={title}>
      <Steps current={step} labels={["Party", "Goods", "Review"]} />
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
          <Button type="submit">Continue →</Button>
        </form>
      )}
      {step === 1 && (
        <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {kind === "SALE" ? "Giving goods to" : "Taking goods from"} <b>{partyName || "…"}</b>
            <button type="button" className="ml-2 underline" onClick={() => setStep(0)}>change</button>
          </div>
          {fields.map((f, i) => (
            <LineCard
              key={f.id}
              index={i}
              kind={kind}
              register={register}
              watch={watch}
              setValue={setValue}
              lastRate={lastRates[watch(`lines.${i}.metal`)]}
              onRemove={fields.length > 1 ? () => remove(i) : undefined}
            />
          ))}
          <Button variant="secondary" type="button" onClick={() => { append(emptyLine()); void trigger(); }}>+ Add item</Button>
          <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">{en.more}</summary>
            <div className="pt-3">
              <Field label="Notes (optional)">
                <Textarea {...register("notes")} rows={2} />
              </Field>
            </div>
          </details>
          {reviewError ? <p className="text-sm font-medium text-red-700">{reviewError}</p> : null}
          <Button type="submit">{en.voucher.review} →</Button>
        </form>
      )}
    </Page>
  );
}

function LineCard({ index, kind, register, watch, setValue, lastRate, onRemove }: {
  index: number;
  kind: "SALE" | "PURCHASE";
  register: UseFormRegister<HeaderForm & { lines: LineForm[] }>;
  watch: UseFormWatch<HeaderForm & { lines: LineForm[] }>;
  setValue: UseFormSetValue<HeaderForm & { lines: LineForm[] }>;
  lastRate: { amountPaise: number } | undefined;
  onRemove?: () => void;
}) {
  const metal = watch(`lines.${index}.metal`);
  const mode = watch(`lines.${index}.mode`);
  const agreed = watch(`lines.${index}.agreedTunch`);
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
          labels={{ GOLD: "Gold", SILVER: "Silver" }}
        />
        <CategoryField metal={metal} value={watch(`lines.${index}.category`)} onPick={(name) => setValue(`lines.${index}.category`, name)} />
        <Field label="Weight" unit={en.units.g}>
          <Input {...register(`lines.${index}.physicalG`)} inputMode="decimal" placeholder="0.000" />
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
            <Input
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
          {kind === "SALE" && (
            <Field label="Labour" unit={en.units.perGram}>
              <Input {...register(`lines.${index}.labour`)} inputMode="decimal" placeholder="0.00" />
            </Field>
          )}
          <div className={kind === "SALE" ? "" : "col-span-2"}>
            <details>
              <summary className="cursor-pointer pt-2 text-sm font-medium text-stone-500">{en.more}</summary>
              <div className="flex flex-col gap-3 pt-2">
                <Field label="Pieces (optional)">
                  <Input {...register(`lines.${index}.itemCount`)} inputMode="numeric" placeholder="—" />
                </Field>
                <Field label="Tested tunch (optional)" unit={en.units.percent}>
                  <Input {...register(`lines.${index}.recordedTunch`)} inputMode="decimal" placeholder="—" />
                </Field>
              </div>
            </details>
          </div>
        </div>
        {hint ? <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-medium text-emerald-800">{hint}</div> : null}
      </div>
    </Card>
  );
}
