# Known limitations (MVP v0.1, Phase 4)

- Local-only: IndexedDB in this browser. No cloud sync, auth, remote backup,
  or tax compliance exists or is claimed. Clearing browser data without an
  export loses records.
- Installable + offline once loaded (precached shell, hash routing). No
  offline write queue — there is nothing to queue: all writes are local.
- Device testing so far is a Pixel 7-viewport E2E; install + restart survival
  on the operator's real Android phone is the Phase 5 pilot's first job.
- Golden scenarios are ILLUSTRATIVE arithmetic checks. No OWNER_APPROVED
  scenario exists yet — no real register examples have been shared.
- Correction flow reverses first, then posts the replacement as a second step;
  abandoning the replacement form leaves a clean reversal (no half-correction).
- UI primitives are a minimal shadcn-style set (Button/Field/Card), not the
  full shadcn/ui component library.
- `ADJUSTMENT` (explicit manual delta) is an agent assumption; the brief
  defines no rule for it. It now requires a reason in `notes` and the
  khata renders it as a visible manual-change entry.
- Rate-unit mismatch (gold vs `SILVER_PER_KG` etc.) throws; mixed-metal
  conversions (gold-for-silver) are rejected as out of scope.
- `REVERSAL` domain support is `negateDeltas()` + original-date rule only;
  atomic reverse-and-replace lives in the Phase 2 data layer.
- Not tested on device; no PWA, offline, persistence, or 360 px UX work yet.
