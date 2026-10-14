import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Steps } from "../../components/ui/Bits.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { postVoucher } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import type { BalanceDelta, Voucher } from "../../domain/index.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { formatGram, formatINR, parseGramsToMg, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
import { uuid } from "../../lib/uuid.ts";
import { PartyPicker } from "./fields.tsx";
import { Review } from "./Review.tsx";

interface Form {
  partyId: string;
  businessDate: string;
  cash: string;
  goldG: string;
  silverG: string;
  notes: string;
}

function parseSignedGrams(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  const negative = t.startsWith("-");
  const mg = parseGramsToMg(negative ? t.slice(1) : t);
  return negative ? -mg : mg;
}

function parseSignedRupees(raw: string): number {
  const t = raw.trim();
  if (!t) return 0;
  return parseRupeesToPaise(t, true);
}

/** Opening balances in FINE weight (Q4), with a review step before saving. */
export function OpeningForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [voucherId] = useState(() => uuid());
  const [preview, setPreview] = useState<Voucher | null>(null);
  const [posted, setPosted] = useState<{ deltas: BalanceDelta; partyId: string } | null>(null);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const partyList = usePartyList();

  const { register, handleSubmit, setValue, watch } = useForm<Form>({
    defaultValues: {
      partyId: params.get("party") ?? "",
      businessDate: todayLocal(),
      cash: "",
      goldG: "",
      silverG: "",
      notes: "",
    },
  });
  const partyId = watch("partyId");
  const partyName = (partyList ?? []).find((p) => p.id === partyId)?.name ?? "";

  const onReview = handleSubmit((v) => {
    setError("");
    try {
      if (!v.partyId) throw new Error("Choose a party");
      const opening = {
        cashPaise: parseSignedRupees(v.cash),
        goldFineMg: parseSignedGrams(v.goldG),
        silverFineMg: parseSignedGrams(v.silverG),
      };
      if (opening.cashPaise === 0 && opening.goldFineMg === 0 && opening.silverFineMg === 0) {
        throw new Error("Enter at least one opening balance");
      }
      setPreview(buildVoucher({
        id: voucherId,
        shopId: "shop-local-1",
        type: "OPENING",
        partyId: v.partyId,
        businessDate: v.businessDate,
        notes: v.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        opening,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid entry");
    }
  });

  const onConfirm = async () => {
    if (!preview?.opening) return;
    setPosting(true);
    setError("");
    try {
      await postVoucher({
        id: voucherId,
        type: "OPENING",
        partyId: preview.partyId,
        businessDate: preview.businessDate,
        notes: preview.notes,
        opening: preview.opening,
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
      <Page title="Opening balance">
        <Card>
          <SuccessView
            title="Opening balance saved"
            summary={
              <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                {partyName} · {formatINR(d.cashPaise)}{d.goldFineMg !== 0 && <> · gold {formatGram(d.goldFineMg)}</>}{d.silverFineMg !== 0 && <> · silver {formatGram(d.silverFineMg)}</>}
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
        <Steps current={2} labels={["Party", "Balance", "Review"]} />
        <Review voucher={preview} cash={d.cashPaise} gold={d.goldFineMg} silver={d.silverFineMg}
          partyName={partyName} posting={posting} error={error}
          onBack={() => setPreview(null)} onConfirm={onConfirm} />
      </Page>
    );
  }

  return (
    <Page title="Opening balance">
      <Steps current={1} labels={["Party", "Balance", "Review"]} />
      <form className="flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
        <Card>
          <div className="flex flex-col gap-3">
            <PartyPicker value={partyId} onChange={(id) => setValue("partyId", id)} />
            <Field label={en.voucher.date}><Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} /></Field>
            <Field label="Cash opening" unit={en.units.inr} hint="Use − for amounts you owe the party">
              <Input {...register("cash")} inputMode="decimal" placeholder="0.00" />
            </Field>
            <Field label="Gold opening (fine)" unit={en.units.g} hint="Use − if you owe the party">
              <Input {...register("goldG")} inputMode="decimal" placeholder="0.000" />
            </Field>
            <Field label="Silver opening (fine)" unit={en.units.g} hint="Use − if you owe the party">
              <Input {...register("silverG")} inputMode="decimal" placeholder="0.000" />
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
