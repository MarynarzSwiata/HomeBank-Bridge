import React, { useCallback, useEffect, useState } from 'react';
import { systemService, type StoredBackup } from '../../api/services';
import { ConfirmModal } from '../common';

/**
 * Backups the server makes by itself: one a day (last 14 days) and one right before
 * every restore, reset or replacing HomeBank import. Each can be downloaded or restored.
 */
interface AutoBackupsProps {
  onRestored: () => Promise<void>;
  notify: (message: string, type: 'success' | 'error') => void;
}

const ACTION_LABEL: Record<string, string> = {
  restore: 'Before restore',
  reset: 'Before reset',
  import: 'Before HomeBank import',
};

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export const AutoBackups: React.FC<AutoBackupsProps> = ({ onRestored, notify }) => {
  const [backups, setBackups] = useState<StoredBackup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<StoredBackup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBackups(await systemService.listBackups());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load backups');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const download = async (b: StoredBackup) => {
    setBusy(b.name);
    try {
      await systemService.downloadBackup(b.name);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (!confirm) return;
    setBusy(confirm.name);
    try {
      await systemService.restoreBackup(confirm.name);
      await onRestored();
      notify(`Data restored from ${formatDate(confirm.createdAt)}`, 'success');
      setConfirm(null);
      await load();
    } catch (err) {
      notify('Restore failed: ' + (err instanceof Error ? err.message : 'unknown error'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-100">Automatic backups</h3>
        <p className="text-sm text-slate-500 mt-1">
          The server saves a copy of all data every day (last 14 days) and right before any restore, reset or
          HomeBank import. Copies are kept on the same server, so also download one now and then.
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
      {!error && backups === null && <p className="text-sm text-slate-500">Loading…</p>}
      {backups?.length === 0 && <p className="text-sm text-slate-500">No backups yet. The first one is made when the server starts.</p>}

      {backups && backups.length > 0 && (
        <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl max-h-80 overflow-y-auto">
          {backups.map(b => (
            <li key={b.name} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-medium text-slate-100 tabular-nums">{formatDate(b.createdAt)}</p>
                <p className="text-xs text-slate-500">
                  {b.kind === 'daily' ? 'Daily' : ACTION_LABEL[b.action ?? ''] ?? 'Safety copy'} · {formatSize(b.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => download(b)}
                disabled={busy !== null}
                className="min-h-[36px] px-3 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-950 disabled:opacity-40"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => setConfirm(b)}
                disabled={busy !== null}
                className="min-h-[36px] px-3 rounded-lg text-sm font-medium border border-slate-700 text-slate-300 hover:text-slate-100 hover:bg-slate-950 disabled:opacity-40"
              >
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        isOpen={!!confirm}
        title="Restore this backup?"
        message={confirm ? `All current data will be replaced with the copy from ${formatDate(confirm.createdAt)}. A copy of the current data is saved first, so you can undo this.` : ''}
        confirmLabel="Restore"
        onConfirm={restore}
        onCancel={() => setConfirm(null)}
        isLoading={busy !== null}
      />
    </div>
  );
};
