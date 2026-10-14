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
                     # assemble/read/recompute, listVouchers; records item use
    categories.ts    # item master: presets + owner customs + usage ranking for the picker
    ledger.ts        # getLedger, getBalances, getBalancesAsOf, getAllBalances,
                     # rebuildLedger (genuine recompute, asserted equal in tests)
    backup.ts        # versioned JSON export, parse/preview, restoreIntoEmpty,
                     # replaceWithBackup (pre-restore export), checkIntegrity
    settings.ts      # last-used rates for labelled prefill
    index.ts
  hooks/             # useLiveQuery wrappers only (usePartyList, useLedgerLive, …)
  features/          # home (dashboard), parties (khata, list, form), vouchers
                     # (new-entry picker, stepped sale/purchase/payment/rate/opening
                     # forms with review + success, voucher detail with reversal),
                     # backup, summary
  components/ui/     # Button, Field/Input/Select/Textarea, Card/Page/BalanceGrid (shadcn-style)
  components/layout/ # Shell (header, backup banner, bottom nav)
  i18n/en.ts         # label dictionary (English; Hindi later)
  lib/format.ts      # INR (en-IN), gram, tunch, exact input parsing
  routes/router.tsx  # createHashRouter (data router: blocking APIs work; hash = zero-config hosting)
docs/
  accounting-rules.md requirements.md architecture.md known-limitations.md
  golden/scenarios.json   # ILLUSTRATIVE only until owner approves
```

Rules: components never import Dexie — they use `hooks/`, which call `data/`
functions. Business logic lives only in `domain/`; forms parse display units
(₹/g/%) to integers (paise/mg/scaled) with decimal.js and validate the final
result through `buildVoucher` on the review screen. Posting uses one
form-generated UUID end-to-end, so double-submit is a no-op.
UX follows the party-khata model (KhataBook/OkCredit-style): `/parties/:id`
is the khata — tinted dues header, day-grouped entries with running balances,
action grid per entry type. New entries start from a plain-language picker
("Sell goods", "Got payment", …) and run as Party → Details → Review wizards
with tunch chips, live per-line hints, and a success screen.
Component rules of thumb: bottom sheets for picking (items, filters, past
balances) and review-before-post; chips for small fixed sets (tunch, modes);
segmented controls for exclusive binary choices (metal, billing, direction);
collapsible "More details" for rarely-used fields (pieces, tested tunch,
ref#, notes) so the primary path stays short. Item names come from a master
(standard presets + owner-managed customs at Settings → Items, usage-ranked,
case-insensitive) — the owner fixes spellings once via rename instead of
retyping them on every bill. Rename/delete touch the master only; posted
history keeps its original strings.

Navigation is app-like, not site-like: the bottom nav shows only on hub
screens (Home, Parties, khata, Summary, Settings); focused flows
(entry wizards, voucher detail, edit, item master) go full-screen with an
explicit back button that falls back safely on deep links. Dirty money forms
are guarded by `useLeaveGuard` — system back or stray taps surface a
Leave/Stay sheet instead of silently discarding the entry.

Storage is Postgres-shaped: one flat table per entity, voucher lines in
`voucher_lines`, settlement/conversion/manual-delta parts in their own tables
(no nested arrays in records), UUID keys, ISO timestamps, constant `shopId`.
Ledger rows use `id === voucherId` (one entry per voucher) so `rebuildLedger()`
compares exactly. Every write path validates via domain BEFORE opening the
Dexie transaction; all multi-row writes share one transaction (all or nothing).

Deferred installs (Phase 2/3): Dexie + dexie-react-hooks, React Hook Form,
Tailwind + shadcn/ui, React Router, vite-plugin-pwa. Verified pre-Phase-2.
