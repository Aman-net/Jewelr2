import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Download, ShieldAlert, ShieldCheck, Tags, Upload } from "lucide-react";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { CheckRow } from "../../components/ui/Field.tsx";
import { CALCULATION_VERSION } from "../../domain/index.ts";
import {
  APP_VERSION,
  BackupError,
  db,
  exportBackup,
  getLastBackupAt,
  previewBackup,
  replaceWithBackup,
  restoreIntoEmpty,
} from "../../data/index.ts";
import type { BackupCounts } from "../../data/index.ts";
import { en } from "../../i18n/en.ts";
import { daysSince } from "../../lib/format.ts";
import { cn } from "../../lib/cn.ts";

function countsLine(c: BackupCounts): string {
  return `${c.parties} parties · ${c.vouchers} vouchers · ${c.ledger_entries} ledger rows`;
}

export function BackupPage() {
  const last = useLiveQuery(() => getLastBackupAt(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{ json: unknown; counts: BackupCounts; empty: boolean } | null>(null);
  const [replaceAck, setReplaceAck] = useState(false);
  const [busy, setBusy] = useState(false);

  const days = last ? daysSince(last) : Infinity;
  const safety = days < 3 ? "safe" : days < 7 ? "due" : "overdue";

  const doExport = async () => {
    setStatus("");
    setError("");
    try {
      const backup = await exportBackup();
      const text = JSON.stringify(backup);
      const filename = `jewelr-backup-${backup.exportedAt.slice(0, 10)}.json`;
      const file = new File([text], filename, { type: "application/json" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Jewelr backup" });
        setStatus("Backup shared. Keep the file somewhere safe — it is the only copy off this device.");
        return;
      }
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Backup downloaded. Keep the file somewhere safe — it is the only copy off this device.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  };

  const onFile = async (f: File) => {
    setStatus("");
    setError("");
    setPending(null);
    setReplaceAck(false);
    try {
      const json: unknown = JSON.parse(await f.text());
      const { counts } = previewBackup(json);
      const nonEmpty = (await Promise.all([
        db.parties.count(),
        db.vouchers.count(),
        db.ledger_entries.count(),
      ])).some((c) => c > 0);
      setPending({ json, counts, empty: !nonEmpty });
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "Could not read that file — is it a Jewelr backup?");
    }
  };

  const doRestore = async () => {
    if (!pending) return;
    if (!pending.empty && !replaceAck) {
      setError("Tick the acknowledgement to replace existing data — this cannot be undone without the pre-restore export.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (pending.empty) {
        const counts = await restoreIntoEmpty(pending.json);
        setStatus(`Restored: ${countsLine(counts)}. Balances verified.`);
      } else {
        const { counts } = await replaceWithBackup(pending.json);
        setStatus(`Replaced all data: ${countsLine(counts)}. A pre-restore export was taken first. Balances verified.`);
      }
      setPending(null);
      setReplaceAck(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Settings">
      <div className={cn(
        "rounded-3xl p-5 text-white shadow-md",
        safety === "safe" ? "bg-gradient-to-br from-emerald-600 to-emerald-800"
        : safety === "due" ? "bg-gradient-to-br from-amber-600 to-amber-800"
        : "bg-gradient-to-br from-red-700 to-red-900",
      )}>
        <div className="flex items-center gap-2">
          {safety === "safe" ? <ShieldCheck size={22} /> : <ShieldAlert size={22} />}
          <span className="text-base font-bold">
            {safety === "safe" ? "Backed up" : safety === "due" ? "Backup due" : "Not backed up"}
          </span>
        </div>
        <div className="mt-1 text-sm text-white/85">
          {last ? `Last backup ${new Date(last).toLocaleString("en-IN")}` : "No backup yet — your records live only on this device."}
        </div>
        <div className="mt-3">
          <Button variant="secondary" full onClick={doExport} className="min-h-12">
            <Download size={18} /> {en.backup.export}
          </Button>
        </div>
      </div>

      <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">Restore</div>
      <Card>
        <div className="mb-2 text-sm font-medium text-stone-900">{en.backup.import}</div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" full onClick={() => fileRef.current?.click()}>
          <Upload size={18} /> Choose backup file…
        </Button>
        {pending && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl bg-stone-50 p-3">
            <div className="text-sm text-stone-700">{countsLine(pending.counts)}</div>
            {!pending.empty && (
              <CheckRow label="Replace ALL existing data (I have a backup)">
                <input type="checkbox" className="h-6 w-6 accent-red-700" checked={replaceAck} onChange={(e) => setReplaceAck(e.target.checked)} />
              </CheckRow>
            )}
            <Button variant={pending.empty ? "primary" : "danger"} disabled={busy} onClick={doRestore}>
              {pending.empty ? "Restore into empty app" : "Replace all data"}
            </Button>
          </div>
        )}
      </Card>

      <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">Master data</div>
      <Link to="/settings/items">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-800">
              <Tags size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-semibold text-stone-900">{en.item.manage}</div>
              <div className="text-xs text-stone-500">Exact spelling of every pickable item.</div>
            </div>
            <span className="shrink-0 text-lg font-bold text-stone-300">›</span>
          </div>
        </Card>
      </Link>

      <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">About this app</div>
      <Card>
        <div className="flex flex-col gap-1 text-xs text-stone-500">
          <div>Jewelr {APP_VERSION} · rules {CALCULATION_VERSION}</div>
          <div>{en.localOnly}</div>
        </div>
      </Card>

      {status ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{status}</div> : null}
      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div> : null}
    </Page>
  );
}
