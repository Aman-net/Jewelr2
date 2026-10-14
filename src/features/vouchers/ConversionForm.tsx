import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Steps } from "../../components/ui/Bits.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Select, Textarea } from "../../components/ui/Field.tsx";
import { Segmented } from "../../components/ui/Segmented.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { getLastRate, postVoucher, setLastRate } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
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

  const { register, handleSubmit, setValue, watch } = useForm<Form>({
    defaultValues: {
      partyId: state.prefill?.partyId ?? params.get("party") ?? "",
      businessDate: state.prefill?.businessDate ?? todayLocal(),
      direction: state.prefill?.direction ?? "METAL_TO_CASH",
      metal: state.prefill?.metal ?? "GOLD",
      fineG: state.prefill?.fineG ?? "",
      rate: state.prefill?.rate ?? "",
      notes: state.correctedFrom ? `Corrects ${state.correctedFrom}` : (state.prefill?.notes ?? ""),
    },
  });
  const partyId = watch("partyId");
  const metal = watch("metal");
  const direction = watch("direction");
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";

  useEffect(() => {
    void getLastRate(metal).then((r) => setLastRateHint(r ? { amountPaise: r.amountPaise } : undefined));
  }, [metal]);

  const onReview = handleSubmit((v) => {
    setError("");
    try {
      if (!v.partyId) throw new Error("Choose a party");
      const fineMg = parseGramsToMg(v.fineG);
      if (fineMg <= 0) throw new Error("Fine weight must be positive");
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
          rateAmountPaise: parseRupeesToPaise(v.rate),
          rateUnit: v.metal === "GOLD" ? "GOLD_PER_10G" : "SILVER_PER_KG",
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
              <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                {partyName} · {formatGram(Math.abs(d.goldFineMg !== 0 ? d.goldFineMg : d.silverFineMg))} ⇄ {formatINR(Math.abs(d.cashPaise))}
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
      <Page title={en.voucher.review}>
        <Steps current={2} labels={["Party", "Rate", "Review"]} />
        <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
          partyName={partyName} posting={posting} error={error}
          onBack={() => setPreview(null)} onConfirm={onConfirm} />
      </Page>
    );
  }

  return (
    <Page title="Fix rate">
      <Steps current={1} labels={["Party", "Rate", "Review"]} />
      <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
        <Card>
          <div className="flex flex-col gap-3">
            <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={en.voucher.date}><Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} /></Field>
              <Field label="Metal">
                <Select {...register("metal")}>
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                </Select>
              </Field>
            </div>
            <Field label="Direction">
              <Segmented
                options={["METAL_TO_CASH", "CASH_TO_METAL"] as const}
                value={direction}
                onChange={(d) => setValue("direction", d)}
                labels={{ METAL_TO_CASH: "Metal → cash", CASH_TO_METAL: "Cash → metal" }}
              />
            </Field>
            <Field label="Fine weight" unit={en.units.g}>
              <Input {...register("fineG")} inputMode="decimal" placeholder="0.000" />
            </Field>
            <Field
              label={en.voucher.rate}
              unit={metal === "GOLD" ? en.units.per10g : en.units.perKg}
              hint={lastRate ? `${en.voucher.lastUsedRate}: ${formatINR(lastRate.amountPaise)} — tap to reuse` : undefined}
            >
              <Input
                {...register("rate")}
                inputMode="decimal"
                placeholder="0.00"
                onFocus={(e) => {
                  if (!e.target.value && lastRate) setValue("rate", String(lastRate.amountPaise / 100));
                }}
              />
            </Field>
            <Field label="Notes (optional)"><Textarea {...register("notes")} rows={2} /></Field>
          </div>
        </Card>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <Button type="submit">{en.voucher.review} →</Button>
      </form>
    </Page>
  );
}
