# Jewelr
Wholesale jewelry business digital ledger

Mobile-first installable PWA replacing the paper party ledger (khata) of one
gold/silver wholesale shop. MVP validates the accounting model in parallel
with the paper register. Local-only; no cloud sync, auth, or tax compliance.

## Status: Phase 3 — core UX

Mobile-first app shell with bottom nav, parties, all voucher types with
review-before-post, chronological ledger with as-of balances, reversal +
correction workflow, all-party summary, and backup export/restore screens.
Styling is Tailwind v4 with a minimal shadcn-style primitive set and
Lucide icons; all labels live in `src/i18n/en.ts` (Hindi later).

## Commands (pnpm)

```sh
pnpm install
pnpm run typecheck   # tsc -b
pnpm run lint        # oxlint
pnpm test            # vitest run
pnpm run dev         # vite dev server
pnpm run build       # tsc -b && vite build
```

> If `pnpm` fails via corepack with `MODULE_NOT_FOUND` for pnpm, run with
> `COREPACK_HOME` pointed at a prepared store, e.g.
> `export COREPACK_HOME=/tmp/corepack-test`.

## Docs

- `docs/accounting-rules.md` — formulas, sign convention, PROVISIONAL rules table
- `docs/requirements.md` — Phase 1 scope vs deferred work
- `docs/architecture.md` — layers and rules
- `docs/known-limitations.md` — what is explicitly not claimed
- `docs/golden/scenarios.json` — executable spec (ILLUSTRATIVE until owner-approved)
