import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { AmountInput, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { FlowHeader, StickyCta } from "../../components/ui/Flow.tsx";
import { useLeaveGuard } from "../../hooks/useLeaveGuard.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { getLastRate, postVoucher, setLastRate } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import { GOLD_QUOTE_MG, SILVER_QUOTE_MG, cashToGoldFine, cashToSilverFine, fineToCash } from "../../domain/numeric/metalValue.ts";
import type { BalanceDelta, ConversionDirection, MetalType, Voucher } from "../../domain/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { formatGram, formatINR, parseGramsToMg, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
import { uuid } from "../../lib/uuid.ts";
import { PartyPicker } from "./fields.tsx";
import { Review } from "./Review.tsx";

interface Form {
  partyId: string;
  businessDate: string;
  direction: ConversionDirection;
  metal: MetalType;
  fineG: string;
  cash: string;
  rate: string;
  notes: string;
}

export function ConversionForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = (location.state as { correctedFrom?: string; prefill?: Partial<Form> } | null) ?? {};
  const [voucherId] = useState(() => uuid());
  const [preview, setPreview] = useState<Voucher | null>(null);
  const [posted, setPosted] = useState<{ deltas: BalanceDelta; partyId: string } | null>(null);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const [lastRate, setLastRateHint] = useState<{ amountPaise: number } | undefined>();
  const partyList = usePartyList();

  const { register, handleSubmit, setValue, watch, formState: { isDirty } } = useForm<Form>({
    defaultValues: {
      partyId: state.prefill?.partyId ?? params.get("party") ?? "",
      businessDate: state.prefill?.businessDate ?? todayLocal(),
      direction: state.prefill?.direction ?? "METAL_TO_CASH",
      metal: state.prefill?.metal ?? "GOLD",
      fineG: state.prefill?.fineG ?? "",
      cash: state.prefill ? prefillCash(state.prefill) : "",
      rate: state.prefill?.rate ?? "",
      notes: state.correctedFrom ? `Corrects ${state.correctedFrom}` : (state.prefill?.notes ?? ""),
    },
  });
  const partyId = watch("partyId");
  const metal = watch("metal");
  const direction = watch("direction");
  const cashRaw = watch("cash");
  const rateRaw = watch("rate");
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";
  const backTo = state.prefill?.partyId ?? params.get("party") ? `/parties/${state.prefill?.partyId ?? params.get("party")}` : "/vouchers/new";
  const { prompt, disarm } = useLeaveGuard(isDirty && !preview && !posted);

  const cashHint = direction === "CASH_TO_METAL" ? cashToFineHint(metal, cashRaw, rateRaw) : null;

  useEffect(() => {
    void getLastRate(metal).then((r) => setLastRateHint(r ? { amountPaise: r.amountPaise } : undefined));
  }, [metal]);

  const onReview = handleSubmit((v) => {
    setError("");
    try {
      if (!v.partyId) throw new Error("Choose a party");
      const rateAmountPaise = parseRupeesToPaise(v.rate);
      const rateUnit = v.metal === "GOLD" ? "GOLD_PER_10G" : "SILVER_PER_KG";
      // Metal→cash starts from the fine weight owed; cash→metal starts from
      // the cash due being converted — the other side is always derived.
      const fineMg =
        v.direction === "METAL_TO_CASH"
          ? parseGramsToMg(v.fineG)
          : v.metal === "GOLD"
            ? cashToGoldFine(parseRupeesToPaise(v.cash), rateAmountPaise)
            : cashToSilverFine(parseRupeesToPaise(v.cash), rateAmountPaise);
      if (fineMg <= 0) throw new Error(v.direction === "METAL_TO_CASH" ? "Fine weight must be positive" : "Cash amount must be positive");
      const built = buildVoucher({
        id: voucherId,
        shopId: "shop-local-1",
        type: "CONVERSION",
        partyId: v.partyId,
        businessDate: v.businessDate,
        notes: v.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        conversion: {
          direction: v.direction,
          metalType: v.metal,
          fineMg,
          rateAmountPaise,
          rateUnit,
        },
      });
      setPreview(built);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid entry");
    }
  });

  const onConfirm = async () => {
    if (!preview?.conversion) return;
    setPosting(true);
    setError("");
    try {
      const c = preview.conversion;
      await postVoucher({
        id: voucherId,
        type: "CONVERSION",
        partyId: preview.partyId,
        businessDate: preview.businessDate,
        notes: preview.notes,
        conversion: {
          direction: c.direction,
          metalType: c.metalType,
          fineMg: c.fineMg,
          rateAmountPaise: c.rateAmountPaise,
          rateUnit: c.rateUnit,
        },
      });
      await setLastRate(c.metalType, { amountPaise: c.rateAmountPaise, unit: c.rateUnit });
      disarm();
      setPosted({ deltas: voucherDeltas(preview), partyId: preview.partyId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  if (posted) {
    const d = posted.deltas;
    return (
      <Page title="Fix rate">
        <Card>
          <SuccessView
            title="Rate fixed"
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

  if (preview) {
    const d = voucherDeltas(preview);
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-4">
        <div className="flex flex-col gap-3">
          <FlowHeader tone="violet" title="Review entry" context={partyName} current={2} labels={["Party", "Rate", "Review"]} />
          <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
            partyName={partyName} posting={posting} error={error}
            onBack={() => setPreview(null)} onConfirm={onConfirm} />
          {prompt}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6 pt-4">
      <div className="flex flex-col gap-3">
        <FlowHeader tone="violet" title="Fix rate" backTo={backTo} context={partyName || undefined} current={1} labels={["Party", "Rate", "Review"]} />
        <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
          <Card>
          <div className="flex flex-col gap-3">
            <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={en.voucher.date}><Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} /></Field>
              <Field label="Fine weight" unit={en.units.g}>
                <AmountInput prefix="g" {...register("fineG")} inputMode="decimal" placeholder="0.000" />
              </Field>
            </div>
            <Field label="Metal">
              <Segmented
                options={["GOLD", "SILVER"] as const}
                value={metal}
                onChange={(m) => setValue("metal", m)}
                labels={{
                  GOLD: <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Gold</span>,
                  SILVER: <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Silver</span>,
                }}
              />
            </Field>
            <Field label="Direction">
              <Segmented
                options={["METAL_TO_CASH", "CASH_TO_METAL"] as const}
                value={direction}
                onChange={(d) => setValue("direction", d)}
                labels={{ METAL_TO_CASH: "Metal → cash", CASH_TO_METAL: "Cash → metal" }}
              />
            </Field>
            {direction === "METAL_TO_CASH" ? (
              <Field label="Fine weight owed" unit={en.units.g}>
                <AmountInput prefix="g" {...register("fineG")} inputMode="decimal" placeholder="0.000" autoFocus />
              </Field>
            ) : (
              <Field label="Cash being converted" unit={en.units.inr}>
                <AmountInput prefix="₹" {...register("cash")} inputMode="decimal" placeholder="0.00" autoFocus />
              </Field>
            )}
            {cashHint ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-900">{cashHint}</div>
            ) : null}
            <Field
              label={en.voucher.rate}
              unit={metal === "GOLD" ? en.units.per10g : en.units.perKg}
              hint={lastRate ? `${en.voucher.lastUsedRate}: ${formatINR(lastRate.amountPaise)} — tap to reuse` : undefined}
            >
              <AmountInput
                prefix="₹"
                {...register("rate")}
                inputMode="decimal"
                placeholder="0.00"
                onFocus={(e) => {
                  if (!e.target.value && lastRate) setValue("rate", String(lastRate.amountPaise / 100));
                }}
              />
            </Field>
            <details>
              <summary className="cursor-pointer text-sm font-medium text-stone-500">{en.more}</summary>
              <div className="pt-2">
                <Field label="Notes (optional)"><Textarea {...register("notes")} rows={2} /></Field>
              </div>
            </details>
          </div>
        </Card>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <StickyCta><Button type="submit" full className="min-h-14 text-lg shadow-lg">{en.voucher.review} →</Button></StickyCta>
      </form>
      {prompt}
      </div>
    </div>
  );
}

function cashToFineHint(metal: MetalType, cashRaw: string, rateRaw: string): string | null {
  try {
    if (!cashRaw.trim() || !rateRaw.trim()) return null;
    const rate = parseRupeesToPaise(rateRaw);
    const cash = parseRupeesToPaise(cashRaw);
    if (cash <= 0) return null;
    const fine = metal === "GOLD" ? cashToGoldFine(cash, rate) : cashToSilverFine(cash, rate);
    return `→ becomes fine ${formatGram(fine)} ${metal === "GOLD" ? "gold" : "silver"}`;
  } catch {
    return null;
  }
}

/** Correction prefill stores fine + rate; re-derive the cash input from them. */
function prefillCash(prefill: Partial<Form>): string {
  try {
    if (prefill.direction !== "CASH_TO_METAL" || !prefill.fineG || !prefill.rate || !prefill.metal) return "";
    const quote = prefill.metal === "GOLD" ? GOLD_QUOTE_MG : SILVER_QUOTE_MG;
    const cashPaise = fineToCash(parseGramsToMg(prefill.fineG), parseRupeesToPaise(prefill.rate), quote);
    return String(cashPaise / 100);
  } catch {
    return "";
  }
}
