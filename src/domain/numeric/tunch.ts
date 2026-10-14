import Decimal from "decimal.js";
import { roundMg } from "./rounding.ts";

/**
 * Tunch is stored as hundredths of a percent: 70.00% = 7000, 91.60% = 9160.
 * CONFIRMED arithmetic; business interpretation of which tunch applies is PROVISIONAL (Q2).
 */
export const TUNCH_SCALE = 10_000;

/** fineMg = round(physicalMg * tunchScaled / 10000). All inputs integers. */
export function fineFromPhysical(physicalMg: number, tunchScaled: number): number {
  return roundMg(new Decimal(physicalMg).mul(tunchScaled).div(TUNCH_SCALE));
}
