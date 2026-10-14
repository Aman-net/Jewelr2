import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Select, Textarea } from "../../components/ui/Field.tsx";
import { getLastRate, postVoucher, setLastRate } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import type { MetalType, PricingMode, Voucher } from "../../domain/index.ts";
import { en } from "../../i18n/en.ts";
import { formatINR, parseGramsToMg, parsePercentToScaled, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
import { usePartyList } from "../../hooks/useLive.ts";
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

const emptyLine = (): LineForm => ({
  metal: "SILVER", category: "", itemCount: "", physicalG: "", recordedTunch: "", agreedTunch: "", mode: "METAL_OPEN", rate: "", labour: "",
});

function rateUnitLabel(metal: MetalType): string {
  return metal === "GOLD" ? en.units.per10g : en.units.perKg;
}

export function SalePurchaseForm({ kind }: { kind: "SALE" | "PURCHASE" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const prefill = (location.state as { prefill?: SalePrefill } | null)?.prefill;
  // Idempotency id: created once when the form opens; reposts are no-ops.
  const [voucherId] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<Voucher | null>(null);
  const [reviewError, setReviewError] = useState("");
  const [posting, setPosting] = useState(false);
  const [lastRates, setLastRates] = useState<Record<string, { amountPaise: number }>>({});

  const { register, control, handleSubmit, setValue, watch, formState: { errors } } = useForm<HeaderForm & { lines: LineForm[] }>({
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

  useEffect(() => {
    void Promise.all([getLastRate("GOLD"), getLastRate("SILVER")]).then(([g, s]) => {
      const r: Record<string, { amountPaise: number }> = {};
      if (g) r.GOLD = { amountPaise: g.amountPaise };
      if (s) r.SILVER = { amountPaise: s.amountPaise };
      setLastRates(r);
    });
  }, []);

  const partyList = usePartyList();
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";

  const onReview = handleSubmit((v) => {
    setReviewError("");
    try {
      if (!v.partyId) throw new Error("Choose a party");
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
          if (!l.category.trim()) throw new Error(`Line ${i + 1}: category is required`);
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
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Invalid entry");
    }
  });

  const onConfirm = async () => {
    if (!preview) return;
    setPosting(true);
    setReviewError("");
    try {
      const header = { partyId: preview.partyId, businessDate: preview.businessDate, referenceNumber: preview.referenceNumber, notes: preview.notes };
      await postVoucher({
        id: voucherId,
        type: kind,
        partyId: header.partyId,
        businessDate: header.businessDate,
        referenceNumber: header.referenceNumber,
        notes: header.notes,
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
      navigate(`/vouchers/${voucherId}`);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  if (preview) {
    const d = voucherDeltas(preview);
    return (
      <Page title={en.voucher.review}>
        <Review
          voucher={preview}
          cash={d.cashPaise}
          gold={d.goldFineMg}
          silver={d.silverFineMg}
          partyName={partyName}
          posting={posting}
          error={reviewError}
          onBack={() => setPreview(null)}
          onConfirm={onConfirm}
        />
      </Page>
    );
  }

  return (
    <Page title={kind === "SALE" ? en.voucher.sale : en.voucher.purchase}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
        <Card>
          <div className="flex flex-col gap-3">
            <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id, { shouldValidate: true })} error={errors.partyId?.message} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={en.voucher.date}>
                <Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} />
              </Field>
              <Field label="Ref # (optional)">
                <Input {...register("referenceNumber")} placeholder="Bill no." />
              </Field>
            </div>
          </div>
        </Card>
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
        <Button variant="secondary" type="button" onClick={() => append(emptyLine())}>+ Add line</Button>
        <Card>
          <Field label="Notes (optional)">
            <Textarea {...register("notes")} rows={2} />
          </Field>
        </Card>
        {reviewError ? <p className="text-sm font-medium text-red-700">{reviewError}</p> : null}
        <Button type="submit">{en.voucher.review} →</Button>
      </form>
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
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-stone-900">Line {index + 1}</span>
        {onRemove ? <button type="button" className="text-sm font-medium text-red-700" onClick={onRemove}>Remove</button> : null}
      </div>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Metal">
            <Select {...register(`lines.${index}.metal` as const)}>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
            </Select>
          </Field>
          <Field label="Item / category">
            <Input {...register(`lines.${index}.category` as const)} placeholder="e.g. Payal" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Weight" unit={en.units.g}>
            <Input {...register(`lines.${index}.physicalG` as const)} inputMode="decimal" placeholder="0.000" />
          </Field>
          <Field label="Pieces (optional)">
            <Input {...register(`lines.${index}.itemCount` as const)} inputMode="numeric" placeholder="—" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Agreed tunch" unit={en.units.percent}>
            <Input {...register(`lines.${index}.agreedTunch` as const)} inputMode="decimal" placeholder="80" />
          </Field>
          <Field label="Recorded (optional)" unit={en.units.percent}>
            <Input {...register(`lines.${index}.recordedTunch` as const)} inputMode="decimal" placeholder="—" />
          </Field>
        </div>
        <Field label="Billing">
          <Select {...register(`lines.${index}.mode` as const)}>
            <option value="METAL_OPEN">Owes metal (rate later)</option>
            <option value="CASH_AT_RATE">Cash at rate now</option>
          </Select>
        </Field>
        {mode === "CASH_AT_RATE" && (
          <Field
            label={en.voucher.rate}
            unit={rateUnitLabel(metal)}
            hint={lastRate ? `${en.voucher.lastUsedRate}: ${formatINR(lastRate.amountPaise)} — tap to reuse` : undefined}
          >
            <Input
              {...register(`lines.${index}.rate` as const)}
              inputMode="decimal"
              placeholder={lastRate ? formatINR(lastRate.amountPaise) : "0.00"}
              onFocus={(e) => {
                if (!e.target.value && lastRate) {
                  setValue(`lines.${index}.rate` as const, String(lastRate.amountPaise / 100));
                }
              }}
            />
          </Field>
        )}
        {kind === "SALE" && (
          <Field label="Labour (optional)" unit={en.units.perGram}>
            <Input {...register(`lines.${index}.labour` as const)} inputMode="decimal" placeholder="0.00" />
          </Field>
        )}
      </div>
    </Card>
  );
}
