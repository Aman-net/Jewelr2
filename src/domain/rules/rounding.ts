/**
 * PROVISIONAL rule Q6 — rounding.
 * Owner decision (2026-10-14): round half up to paise/milligram at LINE level, then sum.
 * No rupee rounding, no customary round-off/discount in v0.1.
 * TODO(owner): Q6 — confirm with a real bill (line vs bill rounding, round-off row?).
 */
export const ROUNDING_POLICY = "LINE_HALF_UP_PAISE_MG" as const;
