import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "businessDate must be YYYY-MM-DD");

export const partySchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  mobile: z.string().trim().max(20).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  isCustomer: z.boolean(),
  isSupplier: z.boolean(),
  active: z.boolean(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).refine((p) => p.isCustomer || p.isSupplier, {
  message: "At least one role flag (isCustomer/isSupplier) must be true",
});

const lineInputSchema = z.object({
  metalType: z.enum(["GOLD", "SILVER"]),
  categoryName: z.string().trim().min(1).max(120),
  itemCount: z.number().int().positive().optional(),
  physicalMg: z.number().int().positive(),
  recordedTunchScaled: z.number().int().min(0).max(10_000).optional(),
  agreedTunchScaled: z.number().int().min(0).max(10_000),
  pricingMode: z.enum(["CASH_AT_RATE", "METAL_OPEN"]),
  rateAmountPaise: z.number().int().positive().optional(),
  rateUnit: z.enum(["GOLD_PER_10G", "SILVER_PER_KG"]).optional(),
  labourMode: z.enum(["PER_PIECE", "PER_KG"]).optional(),
  labourRatePaise: z.number().int().nonnegative().optional(),
  labourPaisePerGram: z.number().int().nonnegative().optional(),
  notes: z.string().trim().max(1000).optional(),
}).refine(
  (l) => (l.pricingMode === "CASH_AT_RATE" ? l.rateAmountPaise !== undefined && l.rateUnit !== undefined : true),
  { message: "CASH_AT_RATE lines require rateAmountPaise and rateUnit" },
).refine(
  (l) => (l.labourMode === "PER_PIECE" ? l.itemCount !== undefined && l.itemCount > 0 : true),
  { message: "Per-piece labour requires itemCount" },
).refine(
  (l) => (l.labourRatePaise !== undefined ? l.labourMode !== undefined : true),
  { message: "labourRatePaise requires labourMode" },
);

const miscSchema = z.object({
  label: z.string().trim().min(1).max(60),
  cashPaise: z.number().int().positive(),
});

const settlementSchema = z.object({
  cashPaise: z.number().int().nonnegative().optional(),
  goldPhysicalMg: z.number().int().nonnegative().optional(),
  goldTunchScaled: z.number().int().min(0).max(10_000).optional(),
  silverPhysicalMg: z.number().int().nonnegative().optional(),
  silverTunchScaled: z.number().int().min(0).max(10_000).optional(),
  paymentMode: z.enum(["CASH", "UPI", "BANK"]).optional(),
});

const conversionSchema = z.object({
  direction: z.enum(["CASH_TO_METAL", "METAL_TO_CASH"]),
  metalType: z.enum(["GOLD", "SILVER"]),
  side: z.enum(["PARTY_OWES", "SHOP_OWES"]),
  fineMg: z.number().int().positive(),
  rateAmountPaise: z.number().int().positive(),
  rateUnit: z.enum(["GOLD_PER_10G", "SILVER_PER_KG"]),
});

const balanceDeltaSchema = z.object({
  cashPaise: z.number().int(),
  goldFineMg: z.number().int(),
  silverFineMg: z.number().int(),
});

export const voucherInputSchema = z.object({
  id: z.string().uuid(),
  shopId: z.string().min(1),
  type: z.enum([
    "OPENING",
    "SALE",
    "PURCHASE",
    "RECEIPT",
    "PAYMENT",
    "CONVERSION",
    "ADJUSTMENT",
    "REVERSAL",
  ]),
  partyId: z.string().uuid(),
  businessDate: isoDate,
  referenceNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  reversesVoucherId: z.string().uuid().optional(),
  reversalReason: z.string().trim().min(1).max(1000).optional(),
  lines: z.array(lineInputSchema).optional(),
  settlement: settlementSchema.optional(),
  conversion: conversionSchema.optional(),
  opening: balanceDeltaSchema.optional(),
  adjustment: balanceDeltaSchema.optional(),
  misc: z.array(miscSchema).max(10).optional(),
  createdAt: z.string().datetime({ offset: true }),
});
