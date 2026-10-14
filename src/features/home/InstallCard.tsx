import { useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { isIOS, useInstallPrompt } from "../../hooks/useInstallPrompt.ts";

/**
 * One clear install nudge on Home: a real Install button on Android/Chrome,
 * Share-menu instructions on iOS, nothing when already installed.
 */
export function InstallCard() {
  const { canInstall, installed, install } = useInstallPrompt();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (installed || dismissed) return null;

  if (canInstall) {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-gradient-to-br from-amber-600 to-amber-800 p-4 text-white shadow-md">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Download size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-base font-bold">Install Jewelr</div>
          <div className="text-xs text-white/85">Works offline · safer storage · home-screen icon</div>
        </div>
        <Button
          variant="secondary"
          disabled={busy}
          className="shrink-0"
          onClick={() => {
            setBusy(true);
            void install().finally(() => setBusy(false));
          }}
        >
          Install
        </Button>
      </div>
    );
  }

  if (isIOS()) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600">
          <Share size={20} />
        </span>
        <div className="min-w-0 flex-1 text-sm text-stone-700">
          <span className="font-semibold text-stone-900">Install Jewelr: </span>
          tap Share below, then “Add to Home Screen”.
        </div>
        <button className="shrink-0 text-xs font-medium text-stone-400" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
