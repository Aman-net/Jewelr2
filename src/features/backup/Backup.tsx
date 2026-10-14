import { useLiveQuery } from "dexie-react-hooks";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Button } from "../../components/ui/Button.tsx";
import { Card, Page } from "../../components/ui/Card.tsx";
import { CheckRow } from "../../components/ui/Field.tsx";
import {
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

  const doExport = async () => {
    setStatus("");
    setError("");
    try {
      const backup = await exportBackup();
      const text = JSON.stringify(backup);
      const filename = `jewelr2-backup-${backup.exportedAt.slice(0, 10)}.json`;
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
    <Page title="Backup">
      <Card>
        <div className="mb-1 text-sm text-stone-700">{en.localOnly}</div>
        <div className="text-sm text-stone-500">
          {last ? `Last backup: ${new Date(last).toLocaleString("en-IN")}` : "No backup yet."}
        </div>
        <div className="mt-3"><Button full onClick={doExport}>{en.backup.export}</Button></div>
      </Card>
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
        <Button variant="secondary" full onClick={() => fileRef.current?.click()}>Choose backup file…</Button>
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
      <Card>
        <div className="mb-1 text-sm font-medium text-stone-900">{en.item.manage}</div>
        <div className="mb-2 text-sm text-stone-500">Control the exact spelling of every pickable item.</div>
        <Link to="/settings/items"><Button variant="secondary" full>Open item master</Button></Link>
      </Card>
      {status ? <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">{status}</div> : null}
      {error ? <div className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</div> : null}
    </Page>
  );
}
