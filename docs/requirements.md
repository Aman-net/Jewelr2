# Requirements (MVP v0.1, Phase 1 scope)

## What Phase 1 delivers

Pure domain engine only: types, Zod schemas, decimal-safe numeric helpers,
formulas (§6.2), voucher posting functions, provisional rule stubs, unit tests,
illustrative golden scenarios. No UI, no Dexie, no backup, no cloud/auth.

## Deferred to later phases

- Phase 2: DONE — Dexie schema + atomic `postVoucher`/`reverseVoucher`, ledger/as-of
  queries, `rebuildLedger`, backup export/import, integrity checks.
- Phase 3: DONE — core UX in route order (shell + local-data status; parties;
  opening balances; ledger + as-of; sale/purchase with review-before-post;
  receipts/payments/conversion; reversal + correction workflow; summary; backup screen).
- Phase 4: PWA install/offline/update flow, persistence request, backup banner tuning.
- Phase 4: PWA install/offline/update flow, persistence, backup banner.
- Phase 5: 2-week parallel-run pilot with 5–10 real parties.
- v0.2 (only after validation): bill photos, print/share, aggregate stock,
  CSV exports, PIN lock, tunch-margin view, dedicated returns.

## Out of scope (per brief §3)

Karigar/job-work, consignment, gold-for-silver exchange, GST/tax invoicing,
multi-shop, multi-user, cloud sync, rate feeds, AI/OCR, e-commerce, customer
access, bill-wise allocation, per-piece SKU tracking.
