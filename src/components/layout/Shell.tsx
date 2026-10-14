import { useLiveQuery } from "dexie-react-hooks";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { Home, Plus, Settings, Users, Wallet } from "lucide-react";
import { getLastBackupAt } from "../../data/index.ts";
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
  { to: "/vouchers/new/sale", label: en.nav.add, Icon: Plus, end: false },
  { to: "/summary", label: en.nav.summary, Icon: Wallet, end: false },
  { to: "/settings/backup", label: en.nav.settings, Icon: Settings, end: false },
];

export function Shell() {
  const location = useLocation();
  const onNew = location.pathname.startsWith("/vouchers/new");
  return (
    <div className="app-shell min-h-svh bg-stone-100">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-xl px-4 py-2.5">
          <div className="text-base font-semibold text-stone-900">{en.appName}</div>
          <div className="text-[11px] leading-tight text-stone-500">{en.localOnly}</div>
        </div>
        <BackupBanner />
      </header>
      <main>
        <Outlet />
      </main>
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
                  isActive || (to === "/vouchers/new/sale" && onNew) ? "text-amber-800" : "text-stone-500",
                )
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
