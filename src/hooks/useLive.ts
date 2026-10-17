import { useLiveQuery } from "dexie-react-hooks";
import {
  getAllBalances,
  getBalances,
  getLedger,
  getStock,
  listParties,
  listVouchers,
} from "../data/index.ts";
import type { LedgerFilter, VoucherFilter } from "../data/index.ts";

/** React hooks wrapping data functions. useLiveQuery lives here only. */

export function usePartyList(includeInactive = false) {
  return useLiveQuery(() => listParties({ includeInactive }), [includeInactive]);
}

export function useLedgerLive(partyId: string | undefined, filter: LedgerFilter = {}) {
  const key = `${filter.from ?? ""}|${filter.to ?? ""}|${(filter.types ?? []).join(",")}`;
  return useLiveQuery(
    () => (partyId ? getLedger(partyId, filter) : Promise.resolve([])),
    [partyId, key],
  );
}

export function useBalancesLive(partyId: string | undefined) {
  return useLiveQuery(() => (partyId ? getBalances(partyId) : Promise.resolve(undefined)), [partyId]);
}

export function useAllBalancesLive() {
  return useLiveQuery(() => getAllBalances(), []);
}

/** Live shop stock buckets for hints, warnings, and the stock screen. */
export function useStockLive() {
  return useLiveQuery(() => getStock(), []);
}

export function useRecentVouchersLive(limit = 10, filter: VoucherFilter = {}) {
  const key = `${filter.partyId ?? ""}|${(filter.types ?? []).join(",")}|${filter.from ?? ""}|${filter.to ?? ""}`;
  return useLiveQuery(
    async () => (await listVouchers(filter)).slice(0, limit),
    [limit, key],
  );
}
