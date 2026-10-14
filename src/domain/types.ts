/**
 * Domain types. Pure TS only — no React, no Dexie.
 * Money = integer paise. Weight = integer milligrams.
 * Tunch = integer hundredths of a percent (70.00% = 7000).
 */

export type MetalType = "GOLD" | "SILVER";
export type RateUnit = "GOLD_PER_10G" | "SILVER_PER_KG";
export type PricingMode = "CASH_AT_RATE" | "METAL_OPEN";
export type VoucherType =
  | "OPENING"
  | "SALE"
  | "PURCHASE"
  | "RECEIPT"
  | "PAYMENT"
  | "CONVERSION"
  | "ADJUSTMENT"
  | "REVERSAL";
export type ConversionDirection = "CASH_TO_METAL" | "METAL_TO_CASH";
export type PaymentMode = "CASH" | "UPI" | "BANK";

export interface Party {
  id: string;
  shopId: string;
  name: string;
  mobile?: string;
  address?: string;
  notes?: string;
  isCustomer: boolean;
  isSupplier: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalePurchaseLineInput {
  metalType: MetalType;
  categoryName: string;
  itemCount?: number;
  /** Physical weight in milligrams (integer). */
  physicalMg: number;
  /** Actual/tested purity of the goods. Info only. */
  recordedTunchScaled?: number;
  /** Tunch agreed for billing. Party owes fine on this. PROVISIONAL Q2. */
  agreedTunchScaled: number;
  pricingMode: PricingMode;
  rateAmountPaise?: number;
  rateUnit?: RateUnit;
  labourPaisePerGram?: number;
  notes?: string;
}

/** Line with computed snapshots (stored on the voucher, never recomputed later). */
export interface SalePurchaseLine extends SalePurchaseLineInput {
  id: string;
  voucherId: string;
  fineMg: number;
  labourPaise: number;
  lineCashPaise: number;
}

export interface SettlementInput {
  cashPaise?: number;
  goldPhysicalMg?: number;
  goldTunchScaled?: number;
  silverPhysicalMg?: number;
  silverTunchScaled?: number;
  paymentMode?: PaymentMode;
}

export interface SettlementSnapshot extends SettlementInput {
  goldFineMg: number;
  silverFineMg: number;
}

export interface ConversionInput {
  direction: ConversionDirection;
  metalType: MetalType;
  /** Fine weight moved. */
  fineMg: number;
  rateAmountPaise: number;
  rateUnit: RateUnit;
}

export interface VoucherInput {
  id: string;
  shopId: string;
  type: VoucherType;
  partyId: string;
  /** YYYY-MM-DD business date. Backdated entries allowed. */
  businessDate: string;
  referenceNumber?: string;
  notes?: string;
  reversesVoucherId?: string;
  reversalReason?: string;
  lines?: SalePurchaseLineInput[];
  settlement?: SettlementInput;
  conversion?: ConversionInput;
  /** Opening deltas, only for OPENING vouchers. PROVISIONAL Q4. */
  opening?: BalanceDelta;
  /** Explicit manual delta, only for ADJUSTMENT vouchers (e.g. returns handling, Q7). */
  adjustment?: BalanceDelta;
  createdAt: string;
}

export interface Voucher extends Omit<VoucherInput, "lines" | "settlement" | "conversion" | "opening" | "adjustment"> {
  calculationVersion: string;
  lines: SalePurchaseLine[];
  settlement: SettlementSnapshot | null;
  conversion: (ConversionInput & { cashPaise: number }) | null;
  opening: BalanceDelta | null;
  adjustment: BalanceDelta | null;
}

/** Sign convention: positive = party owes shop; negative = shop owes party. */
export interface BalanceDelta {
  cashPaise: number;
  goldFineMg: number;
  silverFineMg: number;
}

export interface LedgerEntryDelta {
  voucherId: string;
  partyId: string;
  businessDate: string;
  cashDeltaPaise: number;
  goldFineDeltaMg: number;
  silverFineDeltaMg: number;
  description: string;
}
