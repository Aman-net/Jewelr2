# Architecture (Phase 1)

```
src/
  domain/            # pure TS: types, schemas, numeric, rules, posting. No React, no Dexie.
    numeric/         # rounding, tunch, metalValue, labour (+ arithmetic.test.ts)
    rules/           # Q1–Q6, Q8 provisional stubs, versioned via CALCULATION_VERSION
    posting/         # postVoucher (buildVoucher/voucherDeltas/toLedgerEntry), ledger (as-of),
                     # reversal (buildReversal), tests
    version.ts       # CALCULATION_VERSION = 0.1.0-phase1
    types.ts schemas.ts index.ts
  data/              # thin Dexie access layer. No business math — delegates to domain/.
    db.ts            # JewelrDb schema v1, SHOP_ID, row types, createTestDb/clearDb
    parties.ts       # create/search/update (+ audit events, duplicate-name warning)
    vouchers.ts      # postVoucher (atomic, idempotent), reverseVoucher, replaceVoucher,
                     # assemble/read/recompute, listVouchers
    ledger.ts        # getLedger, getBalances, getBalancesAsOf, getAllBalances,
                     # rebuildLedger (genuine recompute, asserted equal in tests)
    backup.ts        # versioned JSON export, parse/preview, restoreIntoEmpty,
                     # replaceWithBackup (pre-restore export), checkIntegrity
    settings.ts      # last-used rates for labelled prefill
    index.ts
  hooks/             # useLiveQuery wrappers only (usePartyList, useLedgerLive, …)
  features/          # parties, vouchers (entry + review + detail), ledger, summary, backup, home
  components/ui/     # Button, Field/Input/Select/Textarea, Card/Page/BalanceGrid (shadcn-style)
  components/layout/ # Shell (header, backup banner, bottom nav)
  i18n/en.ts         # label dictionary (English; Hindi later)
  lib/format.ts      # INR (en-IN), gram, tunch, exact input parsing
  routes/router.tsx  # HashRouter (zero-config static hosting + PWA scope)
docs/
  accounting-rules.md requirements.md architecture.md known-limitations.md
  golden/scenarios.json   # ILLUSTRATIVE only until owner approves
```

Rules: components never import Dexie — they use `hooks/`, which call `data/`
functions. Business logic lives only in `domain/`; forms parse display units
(₹/g/%) to integers (paise/mg/scaled) with decimal.js and validate the final
result through `buildVoucher` on the review screen. Posting uses one
form-generated UUID end-to-end, so double-submit is a no-op.

Storage is Postgres-shaped: one flat table per entity, voucher lines in
`voucher_lines`, settlement/conversion/manual-delta parts in their own tables
(no nested arrays in records), UUID keys, ISO timestamps, constant `shopId`.
Ledger rows use `id === voucherId` (one entry per voucher) so `rebuildLedger()`
compares exactly. Every write path validates via domain BEFORE opening the
Dexie transaction; all multi-row writes share one transaction (all or nothing).

Deferred installs (Phase 2/3): Dexie + dexie-react-hooks, React Hook Form,
Tailwind + shadcn/ui, React Router, vite-plugin-pwa. Verified pre-Phase-2.
