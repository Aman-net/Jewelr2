# Accounting rules (calculation engine v0.1.0-phase1)

Source of truth for the brief: `jewellery-hisaab-mvp-agent-brief.md` §6.
`calculationVersion` stamped on every voucher: `0.1.0-phase1`.

## Sign convention (CONFIRMED)

Positive = party owes the shop. Negative = shop owes the party.
Three separate columns: cash (paise), fine gold (mg), fine silver (mg).
Never merge columns; cross-column moves happen only via an explicit CONVERSION voucher.

## Numeric representation (CONFIRMED approach)

Cash in integer paise, weights in integer milligrams, tunch in hundredths of a
percent (70.00% = 7000), rates in integer paise per quote unit with an explicit
`rateUnit` (`GOLD_PER_10G` = 10,000 mg, `SILVER_PER_KG` = 1,000,000 mg).
`decimal.js` for intermediate math; round half up to paise/milligram.

## Formulas (CONFIRMED arithmetic)

```
fineMg    = round(physicalMg * tunchScaled / 10000)
gold  ₹   = round(fineMg * ratePaisePer10g / 10000)
silver ₹  = round(fineMg * ratePaisePerKg  / 1000000)
gold  fine from ₹ = round(cashPaise * 10000   / ratePaisePer10g)
silver fine from ₹ = round(cashPaise * 1000000 / ratePaisePerKg)
labour ₹  = round(physicalMg * labourPaisePerGram / 1000)
```

## PROVISIONAL rules (owner decisions 2026-10-14, awaiting register examples)

| ID | Rule | Decision | Code |
|----|------|----------|------|
| Q1 | Pricing mode on sale/purchase | Both `CASH_AT_RATE` and `METAL_OPEN`, mixable per line | `domain/rules/pricingMode.ts` |
| Q2 | Billing tunch | Party owes fine on **agreed** tunch; recorded is info only; receipts credit physical × tested tunch | `domain/rules/tunch.ts` |
| Q3 | Mixed settlement | Each component hits its own column; order is UX only | `domain/rules/settlement.ts` |
| Q4 | Opening unit | Opening metal is **fine** weight | `domain/rules/opening.ts` |
| Q5 | Labour basis | **Owner-confirmed 2026-10-15:** cash-only, on SALE and PURCHASE, `PER_PIECE` (count required) or `PER_KG` (÷1000 internally) | `domain/rules/labour.ts` |
| Q6 | Rounding | Half up, **line level**, to paise/mg, then sum | `domain/rules/rounding.ts` |
| Q8 | Reversal dating | Reversal uses the **original** businessDate (rewrites as-of history) | `domain/rules/reversal.ts` |

## Owner-confirmed additions (2026-10-15, confirmed in chat with worked examples)

- **Misc charges:** voucher-level labelled cash extras on SALE/PURCHASE only;
  sign follows voucher direction (sale +, purchase −).
- **Conversion sides:** every conversion carries `side` (`PARTY_OWES` shrinks
  party dues, `SHOP_OWES` shrinks shop dues) alongside direction. The four
  confirmed cases (Ex.1–Ex.4 in chat 2026-10-15): metal→cash and cash→metal
  on both sides, each shrinking the picked side and growing the other by the
  rate equivalent. Over-conversion posts with a form-level warning, never a
  block.
- **Weight precision (owner-confirmed 2026-10-16):** silver is whole grams
  everywhere (half up: 2.3 g → 2 g, 4.5 g → 5 g); gold keeps milligrams
  (half up past 3 decimals). Applied at snapshot time to physical, fine,
  settlement, conversion (cash re-derives from the rounded fine), opening,
  adjustments, and stock — so previews, history, and the PDF all agree.
- **One live opening per party** (data-layer rule, reversal-aware correction).

Q7 (returns) and Q9 (payment modes) need no calculation rule in v0.1:
returns = reversal + replacement/`ADJUSTMENT`; payment mode is a tag only.

## Data-layer integrity rules (owner-confirmed, enforced in code)

- One **live** opening balance per party (`assertSingleOpening` in
  `data/vouchers.ts`). It may be posted at creation or later with a backdated
  as-of date, but a second opening is rejected — corrections go through
  reversal + replacement. Reversed openings don't count.
- **Role direction** (owner-confirmed 2026-10-15): SALE needs `isCustomer`,
  PURCHASE needs `isSupplier` (`assertRoleDirection`). Unknown parties are
  rejected. Money flows and openings stay open to all roles.

## Agent assumption (no brief rule)

`ADJUSTMENT` posts an explicit manual `adjustment` delta. The brief lists the
type but defines no posting rule; this keeps v0.1 returns handling workable.
Flag for owner review.
