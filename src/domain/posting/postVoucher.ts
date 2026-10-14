import { CALCULATION_VERSION } from "../version.ts";
import { voucherInputSchema } from "../schemas.ts";
import { GOLD_QUOTE_MG, SILVER_QUOTE_MG, fineToCash } from "../numeric/metalValue.ts";
import { lineFineMg, selectBillingTunch, settlementFineMg } from "../rules/tunch.ts";
import { computeLabour } from "../rules/labour.ts";
import { settlementToDeltas } from "../rules/settlement.ts";
import { interpretOpeningMetal } from "../rules/opening.ts";
import { expectedRateUnit, isCashPriced } from "../rules/pricingMode.ts";
import type {
  BalanceDelta,
  ConversionInput,
  LedgerEntryDelta,
  SalePurchaseLine,
  SalePurchaseLineInput,
  SettlementInput,
  SettlementSnapshot,
  Voucher,
  VoucherInput,
} from "../types.ts";

/** Negate, normalizing -0 to 0 so zero columns stay exactly zero. */
function neg(n: number): number {
  return n === 0 ? 0 : -n;
}

function quoteMgFor(unit: "GOLD_PER_10G" | "SILVER_PER_KG"): number {
  return unit === "GOLD_PER_10G" ? GOLD_QUOTE_MG : SILVER_QUOTE_MG;
}

function assertRateUnitMatches(
  metal: "GOLD" | "SILVER",
  unit: "GOLD_PER_10G" | "SILVER_PER_KG",
): void {
  if (expectedRateUnit(metal) !== unit) {
    throw new Error(`Rate unit ${unit} does not match metal ${metal}`);
  }
}

function snapshotLine(
  voucherId: string,
  index: number,
  line: SalePurchaseLineInput,
): SalePurchaseLine {
  const billingTunch = selectBillingTunch(line.recordedTunchScaled, line.agreedTunchScaled);
  const fineMg = lineFineMg(line.physicalMg, billingTunch);
  // Labour is cash-only, per piece or per kg, sale and purchase (owner-confirmed).
  const labourPaise = computeLabour(line.physicalMg, line.itemCount, line.labourMode, line.labourRatePaise);
  let lineCashPaise = 0;
  if (isCashPriced(line.pricingMode)) {
    if (line.rateAmountPaise === undefined || line.rateUnit === undefined) {
      throw new Error("CASH_AT_RATE line requires rateAmountPaise and rateUnit");
    }
    assertRateUnitMatches(line.metalType, line.rateUnit);
    lineCashPaise = fineToCash(fineMg, line.rateAmountPaise, quoteMgFor(line.rateUnit));
  }
  return {
    ...line,
    id: `${voucherId}#L${index}`,
    voucherId,
    fineMg,
    labourPaise,
    lineCashPaise,
  };
}

function snapshotSettlement(s: SettlementInput): SettlementSnapshot {
  return {
    ...s,
    goldFineMg:
      s.goldPhysicalMg && s.goldTunchScaled !== undefined
        ? settlementFineMg(s.goldPhysicalMg, s.goldTunchScaled)
        : 0,
    silverFineMg:
      s.silverPhysicalMg && s.silverTunchScaled !== undefined
        ? settlementFineMg(s.silverPhysicalMg, s.silverTunchScaled)
        : 0,
  };
}

function snapshotConversion(c: ConversionInput): ConversionInput & { cashPaise: number } {
  assertRateUnitMatches(c.metalType, c.rateUnit);
  const cashPaise = fineToCash(c.fineMg, c.rateAmountPaise, quoteMgFor(c.rateUnit));
  return { ...c, cashPaise };
}

/**
 * Validate input and compute immutable snapshots. Deterministic: same input → same voucher.
 * The stored snapshots freeze the rate/tunch used, so later rate changes never alter history.
 */
export function buildVoucher(input: VoucherInput): Voucher {
  const parsed = voucherInputSchema.parse(input);

  if (parsed.type === "SALE" || parsed.type === "PURCHASE") {
    if (!parsed.lines || parsed.lines.length === 0) throw new Error(`${parsed.type} requires lines`);
  }
  if (parsed.misc && parsed.misc.length > 0 && parsed.type !== "SALE" && parsed.type !== "PURCHASE") {
    throw new Error("Misc charges apply to SALE/PURCHASE only");
  }
  if (parsed.type === "RECEIPT" || parsed.type === "PAYMENT") {
    const s = parsed.settlement;
    const total = (s?.cashPaise ?? 0) + (s?.goldPhysicalMg ?? 0) + (s?.silverPhysicalMg ?? 0);
    if (!s || total <= 0) throw new Error(`${parsed.type} requires a non-empty settlement`);
  }
  if (parsed.type === "CONVERSION" && !parsed.conversion) throw new Error("CONVERSION requires conversion");
  if (parsed.type === "OPENING" && !parsed.opening) throw new Error("OPENING requires opening");
  if (parsed.type === "ADJUSTMENT" && !parsed.adjustment) throw new Error("ADJUSTMENT requires adjustment");
  if (parsed.type === "REVERSAL" && (!parsed.reversesVoucherId || !parsed.reversalReason)) {
    throw new Error("REVERSAL requires reversesVoucherId and reversalReason");
  }

  const lines: SalePurchaseLine[] =
    parsed.type === "SALE" || parsed.type === "PURCHASE"
      ? (parsed.lines ?? []).map((l, i) => snapshotLine(parsed.id, i, l))
      : [];
  const misc = (parsed.type === "SALE" || parsed.type === "PURCHASE") && parsed.misc
    ? parsed.misc.map((m) => ({ label: m.label, cashPaise: m.cashPaise }))
    : [];

  return {
    id: parsed.id,
    shopId: parsed.shopId,
    type: parsed.type,
    partyId: parsed.partyId,
    businessDate: parsed.businessDate,
    referenceNumber: parsed.referenceNumber,
    notes: parsed.notes,
    reversesVoucherId: parsed.reversesVoucherId,
    reversalReason: parsed.reversalReason,
    calculationVersion: CALCULATION_VERSION,
    lines,
    settlement: parsed.settlement ? snapshotSettlement(parsed.settlement) : null,
    conversion: parsed.conversion ? snapshotConversion(parsed.conversion) : null,
    opening: parsed.opening ? { ...parsed.opening } : null,
    adjustment: parsed.adjustment ? { ...parsed.adjustment } : null,
    misc,
    createdAt: parsed.createdAt,
  };
}

function saleDeltas(v: Voucher): BalanceDelta {
  const d: BalanceDelta = { cashPaise: 0, goldFineMg: 0, silverFineMg: 0 };
  for (const l of v.lines) {
    if (isCashPriced(l.pricingMode)) {
      d.cashPaise += l.lineCashPaise + l.labourPaise;
    } else if (l.metalType === "GOLD") {
      d.goldFineMg += l.fineMg;
      d.cashPaise += l.labourPaise;
    } else {
      d.silverFineMg += l.fineMg;
      d.cashPaise += l.labourPaise;
    }
  }
  for (const m of v.misc) d.cashPaise += m.cashPaise;
  return d;
}

/**
 * Conversion with an explicit side (owner-confirmed 2026-10-15).
 * The picked side's due shrinks; the other column grows by the equivalent.
 * - METAL_TO_CASH + PARTY_OWES: metal −Y, cash +X (rate fixed on metal dues).
 * - METAL_TO_CASH + SHOP_OWES: metal +Y, cash −X (shop's metal debt becomes cash debt).
 * - CASH_TO_METAL mirrors both.
 */
function conversionDeltas(v: Voucher): BalanceDelta {
  const c = v.conversion;
  if (!c) throw new Error("CONVERSION voucher missing conversion snapshot");
  // Verify the snapshot matches the stored rate (rate immutability guard).
  const expected = fineToCash(c.fineMg, c.rateAmountPaise, quoteMgFor(c.rateUnit));
  if (expected !== c.cashPaise) throw new Error("Conversion snapshot inconsistent with stored rate");
  const s = c.side === "PARTY_OWES" ? 1 : -1;
  const metal = c.metalType === "GOLD" ? c.fineMg : 0;
  const silver = c.metalType === "SILVER" ? c.fineMg : 0;
  // sz() keeps -0 out of stored deltas (exact-equality tests distinguish it).
  const sz = (n: number): number => (n === 0 ? 0 : n);
  if (c.direction === "METAL_TO_CASH") {
    // Primary (metal) shrinks on the picked side; cash grows by the equivalent.
    return {
      cashPaise: s * c.cashPaise,
      goldFineMg: sz(-s * metal),
      silverFineMg: sz(-s * silver),
    };
  }
  return {
    cashPaise: -s * c.cashPaise,
    goldFineMg: sz(s * metal),
    silverFineMg: sz(s * silver),
  };
}

/**
 * Ledger deltas for a built voucher. Positive = party owes shop.
 * Never merges columns; cross-column moves happen only via CONVERSION.
 */
export function voucherDeltas(v: Voucher): BalanceDelta {
  switch (v.type) {
    case "OPENING":
      if (!v.opening) throw new Error("OPENING voucher missing opening");
      return interpretOpeningMetal({ ...v.opening });
    case "SALE":
      return saleDeltas(v);
    case "PURCHASE": {
      const s = saleDeltas(v);
      return { cashPaise: neg(s.cashPaise), goldFineMg: neg(s.goldFineMg), silverFineMg: neg(s.silverFineMg) };
    }
    case "RECEIPT": {
      if (!v.settlement) throw new Error("RECEIPT voucher missing settlement");
      const s = settlementToDeltas(v.settlement);
      return { cashPaise: neg(s.cashPaise), goldFineMg: neg(s.goldFineMg), silverFineMg: neg(s.silverFineMg) };
    }
    case "PAYMENT": {
      if (!v.settlement) throw new Error("PAYMENT voucher missing settlement");
      return settlementToDeltas(v.settlement);
    }
    case "CONVERSION":
      return conversionDeltas(v);
    case "ADJUSTMENT":
      if (!v.adjustment) throw new Error("ADJUSTMENT voucher missing adjustment");
      return { ...v.adjustment };
    case "REVERSAL":
      throw new Error("REVERSAL deltas need the original voucher — use negateDeltas()");
  }
}

/** Build the ledger entry for a voucher (single entry per voucher, three columns). */
export function toLedgerEntry(v: Voucher, description: string): LedgerEntryDelta {
  const d = voucherDeltas(v);
  return {
    voucherId: v.id,
    partyId: v.partyId,
    businessDate: v.businessDate,
    cashDeltaPaise: d.cashPaise,
    goldFineDeltaMg: d.goldFineMg,
    silverFineDeltaMg: d.silverFineMg,
    description,
  };
}

/** A REVERSAL carries exactly negated deltas of the original. */
export function negateDeltas(original: BalanceDelta): BalanceDelta {
  return { cashPaise: neg(original.cashPaise), goldFineMg: neg(original.goldFineMg), silverFineMg: neg(original.silverFineMg) };
}
