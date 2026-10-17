import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { BalanceGrid, Card, Page } from "../../components/ui/Card.tsx";
import { AmountInput, Field, Input, Textarea } from "../../components/ui/Field.tsx";
import { FlowHeader, StickyCta } from "../../components/ui/Flow.tsx";
import { useLeaveGuard } from "../../hooks/useLeaveGuard.tsx";
import { SuccessView } from "../../components/ui/Success.tsx";
import { SHOP_ID } from "../../data/db.ts";
import { postVoucher } from "../../data/index.ts";
import { buildVoucher, voucherDeltas } from "../../domain/index.ts";
import type { BalanceDelta, Voucher } from "../../domain/index.ts";
import { cn } from "../../lib/cn.ts";
import { usePartyList } from "../../hooks/useLive.ts";
import { en } from "../../i18n/en.ts";
import { parseGramsToMg, parseRupeesToPaise, todayLocal } from "../../lib/format.ts";
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

type Lane = "cash" | "gold" | "silver";
/** Per-lane direction: OWES_ME stores positive (party owes shop), I_OWE flips it. */
type LaneDir = "OWES_ME" | "I_OWE";

const LANES: Record<Lane, { label: string; prefix: string; placeholder: string; field: keyof Form }> = {
  cash: { label: "Cash opening", prefix: "₹", placeholder: "0.00", field: "cash" },
  gold: { label: "Gold opening (fine)", prefix: "g", placeholder: "0.000", field: "goldG" },
  silver: { label: "Silver opening (fine)", prefix: "g", placeholder: "0.000", field: "silverG" },
};

/** Mini direction switch on a lane's label line — no minus keys needed. */
function LaneToggle({ value, onChange }: { value: LaneDir; onChange: (v: LaneDir) => void }) {
  return (
    <span className="flex shrink-0 rounded-full bg-stone-100 p-0.5">
      {([["OWES_ME", "Owes me"], ["I_OWE", "I owe"]] as const).map(([v, text]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-150",
            value === v ? "bg-white text-stone-900 shadow-sm" : "text-stone-500",
          )}
        >
          {text}
        </button>
      ))}
    </span>
  );
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

  const [dir, setDir] = useState<Record<Lane, LaneDir>>({ cash: "OWES_ME", gold: "OWES_ME", silver: "OWES_ME" });
  /** Once the owner flips a lane switch, the role default stops applying. */
  const dirsTouched = useRef(false);
  const partyById = (id: string) => (partyList ?? []).find((p) => p.id === id);
  // Supplier khata opens with the shop owing; customer the reverse. Dual-role
  // parties take the customer side (same precedence as the conversion flow).
  const defaultDirFor = (id: string): LaneDir => {
    const p = partyById(id);
    return p?.isSupplier && !p.isCustomer ? "I_OWE" : "OWES_ME";
  };

  const { register, handleSubmit, setValue, watch, formState: { isDirty } } = useForm<Form>({
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
  const backTo = params.get("party") ? `/parties/${params.get("party")}` : "/vouchers/new";
  const { prompt } = useLeaveGuard(isDirty && !preview && !posted);

  // Role default: supplier opens "I owe", customer "Owes me". Runs until the
  // owner flips a lane switch themselves; party changes re-default.
  useEffect(() => {
    if (partyId && (partyList ?? []).length > 0 && !dirsTouched.current) {
      const base = defaultDirFor(partyId);
      setDir({ cash: base, gold: base, silver: base });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId, partyList]);

  const onReview = handleSubmit((v) => {
    setError("");
    try {
      if (!v.partyId) throw new Error("Choose a party");
      const sign = (lane: Lane) => (dir[lane] === "OWES_ME" ? 1 : -1);
      const opening = {
        cashPaise: parseSignedRupees(v.cash) * sign("cash"),
        goldFineMg: parseSignedGrams(v.goldG) * sign("gold"),
        silverFineMg: parseSignedGrams(v.silverG) * sign("silver"),
      };
      if (opening.cashPaise === 0 && opening.goldFineMg === 0 && opening.silverFineMg === 0) {
        throw new Error("Enter at least one opening balance");
      }
      setPreview(buildVoucher({
        id: voucherId,
        shopId: SHOP_ID,
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
        <div className="flow-step flex flex-col gap-3">
          <FlowHeader tone="stone" title="Review entry" context={partyName} current={2} labels={["Party", "Balance", "Review"]} />
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
        <FlowHeader tone="stone" title="Opening balance" backTo={backTo} context={partyName || undefined} current={1} labels={["Party", "Balance", "Review"]} />
        <form className="flow-step flex flex-col gap-3" onSubmit={(e) => { void onReview(e); }}>
          <Card>
            <div className="flex flex-col gap-3">
              <p className="text-xs text-stone-500">
                Standing khata position at this date. Each lane's switch decides who owed whom — plain numbers, no minus signs.
              </p>
              <PartyPicker
                value={partyId}
                onChange={(id) => {
                  setValue("partyId", id);
                  dirsTouched.current = false; // fresh party -> fresh role defaults
                }}
              />
              <Field label={en.voucher.date}><Input type="date" {...register("businessDate", { required: true })} max={todayLocal()} /></Field>
              {(["cash", "gold", "silver"] as const).map((lane) => (
                <Field
                  key={lane}
                  label={LANES[lane].label}
                  labelAction={
                    <LaneToggle
                      value={dir[lane]}
                      onChange={(v) => {
                        dirsTouched.current = true;
                        setDir((d) => ({ ...d, [lane]: v }));
                      }}
                    />
                  }
                  hint={partyName ? (dir[lane] === "OWES_ME" ? `${partyName} owes you` : `You owe ${partyName}`) : undefined}
                >
                  <AmountInput prefix={LANES[lane].prefix} {...register(LANES[lane].field)} inputMode="decimal" placeholder={LANES[lane].placeholder} />
                </Field>
              ))}
              <details>
                <summary className="cursor-pointer text-sm font-medium text-stone-500">{en.more}</summary>
                <div className="pt-2">
                  <Field label="Notes (optional)"><Textarea {...register("notes")} rows={2} /></Field>
                </div>
              </details>
            </div>
          </Card>
          {error ? <p className="shake text-sm font-medium text-red-700" role="alert">{error}</p> : null}
          <StickyCta><Button type="submit" full className="min-h-14 text-lg shadow-lg">{en.voucher.review} →</Button></StickyCta>
        </form>
        {prompt}
      </div>
    </div>
  );
}
