import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Chip } from "../../components/ui/Bits.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { AmountInput, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { FlowHeader, StickyCta, type FlowTone } from "../../components/ui/Flow.tsx";
import { useLeaveGuard } from "../../hooks/useLeaveGuard.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { postVoucher } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import type { BalanceDelta, PaymentMode, Voucher } from "../../domain/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { parseGramsToMg, parsePercentToScaled, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
import { uuid } from "../../lib/uuid.ts";
import { PartyPicker } from "./fields.tsx";
import { Review } from "./Review.tsx";

interface Form {
  partyId: string;
  businessDate: string;
  paymentMode: PaymentMode | "";
  cash: string;
  goldG: string;
  goldTunch: string;
  silverG: string;
  silverTunch: string;
  referenceNumber: string;
  notes: string;
}

const TUNCH_SHORTCUTS = ["70", "75", "80", "85", "91.6", "100"];

export function SettlementForm({ kind }: { kind: "RECEIPT" | "PAYMENT" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const state = (location.state as { correctedFrom?: string; prefill?: Partial<Form> } | null) ?? {};
  const correctedFrom = state.correctedFrom;
  const [voucherId] = useState(() => uuid());
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState<Voucher | null>(null);
  const [posted, setPosted] = useState<{ deltas: BalanceDelta; partyId: string } | null>(null);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const partyList = usePartyList();

  const { register, handleSubmit, setValue, watch } = useForm<Form>({
    defaultValues: {
      partyId: state.prefill?.partyId ?? params.get("party") ?? "",
      businessDate: state.prefill?.businessDate ?? todayLocal(),
      paymentMode: state.prefill?.paymentMode ?? "",
      cash: state.prefill?.cash ?? "",
      goldG: state.prefill?.goldG ?? "",
      goldTunch: state.prefill?.goldTunch ?? "",
      silverG: state.prefill?.silverG ?? "",
      silverTunch: state.prefill?.silverTunch ?? "",
      referenceNumber: state.prefill?.referenceNumber ?? "",
      notes: correctedFrom ? `Corrects ${correctedFrom}` : (state.prefill?.notes ?? ""),
    },
  });
  const partyId = watch("partyId");
  const goldTunch = watch("goldTunch");
  const silverTunch = watch("silverTunch");
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";
  const title = kind === "RECEIPT" ? "Got payment" : "Paid out";
  const tone: FlowTone = kind === "RECEIPT" ? "emerald" : "orange";
  const shell = "mx-auto w-full max-w-xl px-4 pb-6 pt-4";
  const backTo = state.prefill?.partyId ?? params.get("party") ? `/parties/${state.prefill?.partyId ?? params.get("party")}` : "/vouchers/new";
  const { prompt } = useLeaveGuard(step >= 1 && !posted);

  const nextFromParty = () => {
    setError("");
    if (!partyId) {
      setError(kind === "RECEIPT" ? "Who paid you?" : "Who did you pay?");
      return;
    }
    setStep(1);
  };

  const onReview = handleSubmit((v) => {
    setError("");
    try {
      const cashPaise = v.cash.trim() ? parseRupeesToPaise(v.cash) : 0;
      const goldPhysicalMg = v.goldG.trim() ? parseGramsToMg(v.goldG) : 0;
      const silverPhysicalMg = v.silverG.trim() ? parseGramsToMg(v.silverG) : 0;
      if (cashPaise <= 0 && goldPhysicalMg <= 0 && silverPhysicalMg <= 0) {
        throw new Error("Enter cash and/or metal");
      }
      const built = buildVoucher({
        id: voucherId,
        shopId: "shop-local-1",
        type: kind,
        partyId: v.partyId,
        businessDate: v.businessDate,
        referenceNumber: v.referenceNumber.trim() || undefined,
        notes: v.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        settlement: {
          cashPaise: cashPaise > 0 ? cashPaise : undefined,
          goldPhysicalMg: goldPhysicalMg > 0 ? goldPhysicalMg : undefined,
          goldTunchScaled: goldPhysicalMg > 0 ? parsePercentToScaled(v.goldTunch) : undefined,
          silverPhysicalMg: silverPhysicalMg > 0 ? silverPhysicalMg : undefined,
          silverTunchScaled: silverPhysicalMg > 0 ? parsePercentToScaled(v.silverTunch) : undefined,
          paymentMode: v.paymentMode || undefined,
        },
      });
      setPreview(built);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid entry");
    }
  });

  const onConfirm = async () => {
    if (!preview?.settlement) return;
    setPosting(true);
    setError("");
    try {
      const s = preview.settlement;
      await postVoucher({
        id: voucherId,
        type: kind,
        partyId: preview.partyId,
        businessDate: preview.businessDate,
        referenceNumber: preview.referenceNumber,
        notes: preview.notes,
        settlement: {
          cashPaise: s.cashPaise,
          goldPhysicalMg: s.goldPhysicalMg,
          goldTunchScaled: s.goldTunchScaled,
          silverPhysicalMg: s.silverPhysicalMg,
          silverTunchScaled: s.silverTunchScaled,
          paymentMode: s.paymentMode,
        },
      });
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
      <Page title={title}>
        <Card>
          <SuccessView
            title={kind === "RECEIPT" ? "Payment recorded" : "Payout recorded"}
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
          <FlowHeader tone={tone} title="Review entry" context={partyName} current={2} labels={["Party", "Amount", "Review"]} />
          <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
            partyName={partyName} posting={posting} error={error}
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
          context={step === 1 ? (kind === "RECEIPT" ? `Received from ${partyName || "…"}` : `Paid to ${partyName || "…"}`) : undefined}
          onChangeContext={step === 1 ? () => setStep(0) : undefined}
          current={step}
          labels={["Party", "Amount", "Review"]}
        />
        {step === 0 && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); nextFromParty(); }}>
            <Card>
              <div className="flex flex-col gap-3">
                <div className="text-sm text-stone-500">{kind === "RECEIPT" ? "Who paid you?" : "Who did you pay?"}</div>
                <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id)} />
                <Field label={en.voucher.date}><Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} /></Field>
              </div>
            </Card>
            {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
            <StickyCta><Button type="submit" full className="min-h-14 text-lg shadow-lg">Continue →</Button></StickyCta>
          </form>
        )}
        {step === 1 && (
          <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
            <Card>
              <div className="flex flex-col gap-3">
                <Field label={kind === "RECEIPT" ? "Cash received" : "Cash paid"} unit={en.units.inr}>
                  <AmountInput prefix="₹" {...register("cash")} inputMode="decimal" placeholder="0.00" autoFocus />
                </Field>
                <Field label="Mode">
                  <div className="flex gap-1.5">
                    {(["CASH", "UPI", "BANK"] as const).map((m) => (
                      <Chip
                        key={m}
                        selected={watch("paymentMode") === m}
                        onClick={() => setValue("paymentMode", watch("paymentMode") === m ? "" : m)}
                        className="flex-1 px-2"
                      >
                        {m === "CASH" ? "Cash" : m}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Gold" unit={en.units.g}><Input {...register("goldG")} inputMode="decimal" placeholder="0.000" /></Field>
                  <Field label="Silver" unit={en.units.g}><Input {...register("silverG")} inputMode="decimal" placeholder="0.000" /></Field>
                </div>
              <Field label="Gold tunch" unit={en.units.percent}>
                <div className="flex flex-wrap gap-1.5">
                  {TUNCH_SHORTCUTS.map((t) => (
                    <Chip key={t} selected={goldTunch === t} onClick={() => setValue("goldTunch", t)}>{t}</Chip>
                  ))}
                </div>
                <Input {...register("goldTunch")} inputMode="decimal" placeholder="Or type exact %" className="mt-2" />
              </Field>
              <Field label="Silver tunch" unit={en.units.percent}>
                <div className="flex flex-wrap gap-1.5">
                  {TUNCH_SHORTCUTS.map((t) => (
                    <Chip key={t} selected={silverTunch === t} onClick={() => setValue("silverTunch", t)}>{t}</Chip>
                  ))}
                </div>
                <Input {...register("silverTunch")} inputMode="decimal" placeholder="Or type exact %" className="mt-2" />
              </Field>
            </div>
          </Card>
          <details className="rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
            <summary className="cursor-pointer text-sm font-medium text-stone-700">{en.more}</summary>
            <div className="flex flex-col gap-3 pt-3">
              <Field label="Ref # (optional)"><Input {...register("referenceNumber")} placeholder="—" /></Field>
              <Field label="Notes (optional)"><Textarea {...register("notes")} rows={2} /></Field>
            </div>
          </details>
          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
          <StickyCta><Button type="submit" full className="min-h-14 text-lg shadow-lg">{en.voucher.review} →</Button></StickyCta>
        </form>
      )}
      {prompt}
    </div>
  </div>
  );
}
