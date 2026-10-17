/**
 * Deterministic parents: every screen has exactly one place Back goes,
 * like an app — never wherever history happens to point, like a website.
 * Screens already declare these via backTo; this map drives the system-back
 * interceptor (which BackButton fallbacks can't see) and is unit-tested.
 *
 * Returns null only for the root (system back should exit the app there).
 * Voucher detail needs its party from storage — see needsPartyLookup().
 */
export function parentFor(pathname: string, search = ""): string | null {
  if (pathname === "/") return null;

  if (pathname === "/parties") return "/";
  if (pathname === "/parties/new") return "/parties";

  const partyChild = pathname.match(/^\/parties\/([^/]+)\/(edit|bill|ledger)$/);
  if (partyChild) return `/parties/${partyChild[1]}`;

  // A party's khata belongs to the parties list, not to whichever tab the
  // operator happened to arrive from (owner, 2026-10-17).
  if (/^\/parties\/[^/]+$/.test(pathname)) return "/parties";

  if (pathname === "/vouchers/new") return "/";
  if (/^\/vouchers\/new\/(sale|purchase|receipt|payment|conversion|opening)$/.test(pathname)) {
    const partyId = new URLSearchParams(search).get("party");
    return partyId ? `/parties/${partyId}` : "/vouchers/new";
  }

  if (pathname === "/summary" || pathname === "/settings/backup") return "/";
  if (pathname === "/settings/items") return "/settings/backup";

  if (pathname === "/stock") return "/";
  if (pathname === "/stock/item") return "/stock";
  if (pathname === "/stock/move") {
    // Adjusting a known item returns to its page; seeding returns to the list.
    const p = new URLSearchParams(search);
    const name = p.get("name");
    const metal = p.get("metal");
    if (p.get("mode") === "adjust" && name && (metal === "GOLD" || metal === "SILVER")) {
      return `/stock/item?metal=${metal}&name=${encodeURIComponent(name)}`;
    }
    return "/stock";
  }

  // /vouchers/:id and anything unknown.
  return "/";
}

/**
 * Voucher detail (`/vouchers/:id`) — but never the New-entry picker, whose
 * second segment is the literal "new".
 */
export function isVoucherDetail(pathname: string): boolean {
  return /^\/vouchers\/[^/]+$/.test(pathname) && pathname !== "/vouchers/new";
}

/** Voucher detail's parent is its party's khata — resolved from storage. */
export function needsPartyLookup(pathname: string): boolean {
  return isVoucherDetail(pathname);
}
