import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Select, Textarea } from "../../components/ui/Field.tsx";
import { postVoucher } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import type { PaymentMode, Voucher } from "../../domain/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { parseGramsToMg, parsePercentToScaled, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
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

export function SettlementForm({ kind }: { kind: "RECEIPT" | "PAYMENT" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const location = useLocation();
  const state = (location.state as { correctedFrom?: string; prefill?: Partial<Form> } | null) ?? {};
  const correctedFrom = state.correctedFrom;
  const [voucherId] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<Voucher | null>(null);
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
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";

  const onReview = handleSubmit((v) => {
    setError("");
    try {
      if (!v.partyId) throw new Error("Choose a party");
      const cashPaise = v.cash.trim() ? parseRupeesToPaise(v.cash) : 0;
      const goldG = v.goldG.trim();
      const silverG = v.silverG.trim();
      const goldPhysicalMg = goldG ? parseGramsToMg(goldG) : 0;
      const silverPhysicalMg = silverG ? parseGramsToMg(silverG) : 0;
      if (cashPaise <= 0 && goldPhysicalMg <= 0 && silverPhysicalMg <= 0) {
        throw new Error("Enter cash and/or metal received");
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
      navigate(`/vouchers/${voucherId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post");
    } finally {
      setPosting(false);
    }
  };

  if (preview) {
    const d = voucherDeltas(preview);
    return (
      <Page title={en.voucher.review}>
        <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
          partyName={partyName} posting={posting} error={error}
          onBack={() => setPreview(null)} onConfirm={onConfirm} />
      </Page>
    );
  }

  return (
    <Page title={kind === "RECEIPT" ? en.voucher.receipt : en.voucher.payment}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
        <Card>
          <div className="flex flex-col gap-3">
            <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label={en.voucher.date}><Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} /></Field>
              <Field label="Mode (optional)">
                <Select {...register("paymentMode")}>
                  <option value="">—</option>
                  <option value="CASH">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank</option>
                </Select>
              </Field>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3">
            <Field label="Cash" unit={en.units.inr}><Input {...register("cash")} inputMode="decimal" placeholder="0.00" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Gold" unit={en.units.g}><Input {...register("goldG")} inputMode="decimal" placeholder="0.000" /></Field>
              <Field label="Gold tunch" unit={en.units.percent}><Input {...register("goldTunch")} inputMode="decimal" placeholder="—" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Silver" unit={en.units.g}><Input {...register("silverG")} inputMode="decimal" placeholder="0.000" /></Field>
              <Field label="Silver tunch" unit={en.units.percent}><Input {...register("silverTunch")} inputMode="decimal" placeholder="—" /></Field>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex flex-col gap-3">
            <Field label="Ref # (optional)"><Input {...register("referenceNumber")} placeholder="—" /></Field>
            <Field label="Notes (optional)"><Textarea {...register("notes")} rows={2} /></Field>
          </div>
        </Card>
        {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}
        <Button type="submit">{en.voucher.review} →</Button>
      </form>
    </Page>
  );
}
