import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from "react-router";
import { Home, Plus, RefreshCw, Settings, Users, Wallet } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { getLastBackupAt, getVoucher } from "../../data/index.ts";
import { parentFor } from "../../lib/nav.ts";
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
 * manage) go full-screen with their own back affordance. Deep links land
 * safely either way thanks to BackButton fallbacks.
 */
function navHidden(pathname: string): boolean {
  return (
    pathname.startsWith("/vouchers/new/") ||
    /^\/vouchers\/[^/]+$/.test(pathname) ||
    pathname === "/parties/new" ||
    pathname.endsWith("/edit") ||
    pathname.endsWith("/bill") ||
    pathname.endsWith("/move") ||
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

/**
 * System back, made deterministic: a POP navigation (phone back button,
 * browser back, swipe) lands on the screen's declared parent instead of
 * wherever history points. In-app back buttons already go to parents
 * directly, so any POP reaching here is the platform gesture.
 * Root has no parent — there the platform exits the app, as expected.
 */
function useDeterministicBack() {
  const location = useLocation();
  const navigate = useNavigate();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType !== "POP") return;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx <= 0) return;
    let cancelled = false;
    void (async () => {
      let parent: string | null;
      if (/^\/vouchers\/[^/]+$/.test(location.pathname)) {
        const id = location.pathname.split("/")[2] ?? "";
        const stored = await getVoucher(id).catch(() => undefined);
        parent = stored ? `/parties/${stored.voucher.partyId}` : "/";
      } else {
        parent = parentFor(location.pathname, location.search);
      }
      if (!cancelled && parent) navigate(parent, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search, navType, navigate]);
}

export function Shell() {
  const location = useLocation();
  useDeterministicBack();
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
