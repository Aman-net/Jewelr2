import { useLiveQuery } from "dexie-react-hooks";
import { useLayoutEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Home, Plus, RefreshCw, Settings, Users, Wallet } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { getLastBackupAt, getVoucher } from "../../data/index.ts";
import { isVoucherDetail, parentFor } from "../../lib/nav.ts";
import { en } from "../../i18n/en.ts";
import { daysSince } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";

function BackupBanner() {
  const last = useLiveQuery(() => getLastBackupAt(), []);
  if (last === undefined) return null; // loading or never backed up
  const days = daysSince(last);
  if (days < 3) return null;
  const strong = days >= 7;
  return (
    <Link
      to="/settings/backup"
      className={cn(
        "block px-4 py-2 text-center text-sm font-medium",
        strong ? "bg-red-100 text-red-900" : "bg-amber-100 text-amber-900",
      )}
    >
      {en.backup.reminderWarn}: {new Date(last).toLocaleDateString("en-IN")} — {en.backup.export}
    </Link>
  );
}

const tabs = [
  { to: "/", label: en.nav.home, Icon: Home, end: true },
  { to: "/parties", label: en.nav.parties, Icon: Users, end: false },
  { to: "/vouchers/new", label: en.nav.add, Icon: Plus, end: false },
  { to: "/summary", label: en.nav.summary, Icon: Wallet, end: false },
  { to: "/settings/backup", label: en.nav.settings, Icon: Settings, end: false },
];

/**
 * Hub screens keep the bottom nav; focused flows (entry, detail, edit,
 * manage) go full-screen with their own back affordance. The New-entry picker
 * is a tab destination, not a flow, so it keeps the nav.
 */
function navHidden(pathname: string): boolean {
  return (
    pathname.startsWith("/vouchers/new/") ||
    isVoucherDetail(pathname) ||
    pathname === "/parties/new" ||
    pathname.endsWith("/edit") ||
    pathname.endsWith("/bill") ||
    pathname.endsWith("/move") ||
    pathname === "/stock/item" ||
    pathname === "/settings/items"
  );
}

function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-stone-900 px-4 py-2 text-sm text-white">
      <span className="font-medium">A new version is ready — your data is safe.</span>
      <button
        className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-3 py-1.5 text-xs font-bold text-stone-900"
        onClick={() => {
          setNeedRefresh(false);
          void updateServiceWorker(true);
        }}
      >
        <RefreshCw size={14} /> Reload
      </button>
    </div>
  );
}

/** Where a back press made *from* this screen should land. */
async function backTargetFor(pathname: string, search: string): Promise<string | null> {
  // Home is its own floor: back there never wanders into a tab visited earlier.
  if (pathname === "/") return "/";
  if (isVoucherDetail(pathname)) {
    const id = pathname.split("/")[2] ?? "";
    const stored = await getVoucher(id).catch(() => undefined);
    return stored ? `/parties/${stored.voucher.partyId}` : "/";
  }
  return parentFor(pathname, search);
}

/**
 * System back, made deterministic: a back press lands on the parent of the
 * screen the operator was actually on — not of wherever the browser popped to.
 *
 * Those two differ often enough to matter: a wizard opened from a khata pops
 * *to* that khata, whose own parent is Home, and reading the destination
 * bounced people past the screen they came from. The origin is the contract the
 * in-app back button already follows, so this keeps the two in step.
 *
 * Recognising the press is the fiddly part, because React Router reports every
 * hash change as POP — a reload, a typed URL and an <a href="#/…"> link all
 * arrive looking like a back press. What separates them is the entry itself: a
 * press lands on a history entry this session already showed (React Router
 * gives each one a stable key), while anything that appends an entry invents a
 * new one. The index moving backwards is the backup signal.
 *
 * Home is the one screen with no parent: there a press just stays put, and once
 * the history runs out the platform leaves the app, as expected. Every other
 * screen gets a floor entry laid under it the moment it sits at position 0, so
 * its parent is never more than one press away.
 */
function useSystemBack() {
  const location = useLocation();
  const navigate = useNavigate();
  const from = useRef({ pathname: "/", search: "" });
  const prevIdx = useRef<number | null>(null);
  const seen = useRef(new Set<string>());

  useLayoutEffect(() => {
    const rawIdx = (window.history.state as { idx?: number } | null)?.idx;
    const idx = typeof rawIdx === "number" ? rawIdx : null;
    const here = `${location.pathname}${location.search}`;
    const origin = from.current;
    const visited = location.key !== "default" && seen.current.has(location.key);
    const pressedBack = visited || (idx !== null && prevIdx.current !== null && idx < prevIdx.current);
    seen.current.add(location.key);
    prevIdx.current = idx;
    from.current = { pathname: location.pathname, search: location.search };

    if (pressedBack) {
      let cancelled = false;
      void (async () => {
        const target = await backTargetFor(origin.pathname, origin.search);
        if (cancelled || !target || target === here) return;
        navigate(target, { replace: true });
      })();
      return () => {
        cancelled = true;
      };
    }

    // Not a press: just make sure the next one has somewhere in-app to land.
    if (idx === 0 && parentFor(location.pathname, location.search)) {
      navigate(here, { replace: false });
    }
  }, [location.key, location.pathname, location.search, navigate]);
}

/**
 * Hosts the system-back rules *outside* the per-route error boundary. That
 * boundary is keyed by pathname (so navigating away from a crash clears it),
 * which remounts everything inside — and these rules hold state that has to
 * outlive a route change: the screen the press came *from*, and the depth we
 * last saw.
 */
export function SystemBack() {
  useSystemBack();
  return null;
}

export function Shell() {
  const location = useLocation();
  const showNav = !navHidden(location.pathname);
  return (
    <div className={showNav ? "app-shell min-h-svh bg-stone-100" : "min-h-svh bg-stone-100"}>
      <UpdateBanner />
      <BackupBanner />
      <main>
        <Outlet />
      </main>
      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto grid max-w-xl grid-cols-5">
            {tabs.map(({ to, label, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                    isActive ? "text-amber-800" : "text-stone-500",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={22} fill={isActive ? "currentColor" : "none"} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
