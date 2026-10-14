# Jewelr
Wholesale jewelry business digital ledger

Mobile-first installable PWA replacing the paper party ledger (khata) of one
gold/silver wholesale shop. MVP validates the accounting model in parallel
with the paper register. Local-only; no cloud sync, auth, or tax compliance.

## Status: Phase 4 — installable PWA

Installable (manifest, generated icons), offline-capable (precached shell),
persistence requested on first run with status in Settings → About, safe
update prompt, lazy-loaded backup/summary/items/detail screens, and a
Pixel-7 E2E covering create → transact → reload → offline open.

## Commands (pnpm)

```sh
pnpm install
pnpm run typecheck   # tsc -b
pnpm run lint        # oxlint
pnpm test            # vitest run
pnpm run test:e2e    # playwright (Pixel 7): create → transact → reload → offline
pnpm run dev         # vite dev server
pnpm run build       # tsc -b && vite build (emits manifest + service worker)
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
