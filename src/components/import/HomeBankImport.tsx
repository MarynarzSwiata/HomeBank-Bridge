import React, { useRef, useState } from 'react';
import { systemService, type XhbImportResult } from '../../api/services';

/**
 * Import of a HomeBank desktop file (.xhb): pick file -> preview what will be imported -> confirm.
 * If the app already has data, the user must download a backup option and explicitly confirm replacing it.
 */

interface HomeBankImportProps {
  onBackup: () => Promise<void>;
  onImported: () => Promise<void>;
  notify: (message: string, type: 'success' | 'error') => void;
}

const LABELS: [keyof XhbImportResult['summary'], string][] = [
  ['accounts', 'Accounts'],
  ['transactions', 'Transactions'],
  ['transfers', 'Transfers (pairs)'],
  ['categories', 'Categories'],
  ['payees', 'Payees'],
  ['budgets', 'Budget entries'],
  ['scheduled', 'Scheduled'],
  ['templates', 'Templates'],
  ['rules', 'Rules'],
];

export const HomeBankImport: React.FC<HomeBankImportProps> = ({ onBackup, onImported, notify }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<XhbImportResult | null>(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<'preview' | 'import' | 'backup' | 'export' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setReplace(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const pick = async (f: File | null) => {
    reset();
    if (!f) return;
    setFile(f);
    try {
      setBusy('preview');
      setPreview(await systemService.importXhb(f, 'preview'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!file || !preview) return;
    try {
      setBusy('import');
      setError(null);
      const result = await systemService.importXhb(file, 'import', replace);
      await onImported();
      notify(`Imported ${result.summary.accounts} accounts and ${result.summary.transactions} transactions from HomeBank`, 'success');
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  const runExport = async () => {
    try {
      setBusy('export');
      setError(null);
      await systemService.exportXhb();
      notify('HomeBank file downloaded', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };

  const mustConfirmReplace = !!preview?.hasExistingData;
  const canImport = !!preview && !busy && (!mustConfirmReplace || replace);

  return (
    <div className="md:col-span-2 bg-slate-900/50 p-10 rounded-[3rem] border border-slate-800 space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="w-12 h-12 shrink-0 bg-emerald-600/10 rounded-2xl flex items-center justify-center text-emerald-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-black text-white uppercase italic">HomeBank file (.xhb)</h3>
          <p className="text-slate-400 text-sm leading-relaxed mt-2">
            Move your history from HomeBank desktop: choose your <span className="text-emerald-400 font-bold">.xhb</span> file.
            You will see what will be imported before anything is saved. The import is all-or-nothing.
            Export saves everything from this app as a file HomeBank desktop can open.
          </p>
        </div>
        <button
          onClick={runExport}
          disabled={!!busy}
          className="ml-auto shrink-0 px-5 py-3 rounded-xl bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40"
        >
          {busy === 'export' ? 'Exporting…' : 'Export .xhb'}
        </button>
      </div>

      <label className="block">
        <span className="sr-only">HomeBank file</span>
        <input
          ref={inputRef}
          type="file"
          accept=".xhb,application/xml,text/xml"
          onChange={e => pick(e.target.files?.[0] || null)}
          disabled={!!busy}
          className="block w-full text-sm text-slate-300 file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-slate-800 file:text-slate-200 file:font-black file:uppercase file:tracking-widest file:text-[10px] hover:file:bg-slate-700"
        />
      </label>

      {busy === 'preview' && <p className="text-sm text-slate-400">Reading file…</p>}
      {error && <p role="alert" className="text-sm font-bold text-rose-400">{error}</p>}

      {preview && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LABELS.map(([key, label]) => (
              <div key={key} className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
                <div className="text-xl font-black text-slate-100 tabular-nums">{(preview.summary[key] as number | undefined) ?? 0}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Currencies: {preview.summary.currencies.join(', ') || '—'}</p>
          {preview.summary.warnings.length > 0 && (
            <ul className="text-xs text-amber-300 space-y-1 list-disc pl-5">
              {preview.summary.warnings.map(w => <li key={w}>{w}</li>)}
            </ul>
          )}

          {mustConfirmReplace && (
            <div className="p-5 rounded-2xl border border-rose-500/40 bg-rose-500/5 space-y-4">
              <p className="text-sm text-rose-200 font-bold">
                This app already has data. Importing will delete all current accounts, transactions, categories,
                payees, budgets, scheduled items and rules, and replace them with the HomeBank file.
              </p>
              <button
                onClick={async () => { setBusy('backup'); try { await onBackup(); } finally { setBusy(null); } }}
                disabled={!!busy}
                className="px-5 py-3 rounded-xl bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40"
              >
                {busy === 'backup' ? 'Downloading…' : 'Download backup first'}
              </button>
              <label className="flex items-center gap-3 text-sm text-slate-200 cursor-pointer select-none">
                <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-rose-600" />
                Yes, replace all current data
              </label>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              onClick={runImport}
              disabled={!canImport}
              className="px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-30"
            >
              {busy === 'import' ? 'Importing…' : 'Import'}
            </button>
            <button onClick={reset} disabled={!!busy} className="px-8 py-4 rounded-2xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-[0.3em]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
