import React, { useEffect, useState } from 'react';
import type { CurrencyRates } from '../../utils/currencyUtils';

/**
 * Base currency and exchange rates (HomeBank convention: 1 base = rate × currency).
 * Used to show account totals converted to one currency.
 */
interface CurrencyRatesEditorProps {
  rates: CurrencyRates;
  currencies: string[]; // currencies used by accounts
  onSave: (base: string, rates: Record<string, number>) => Promise<boolean>;
}

const parse = (v: string) => parseFloat(v.replace(/\s/g, '').replace(',', '.'));

export const CurrencyRatesEditor: React.FC<CurrencyRatesEditorProps> = ({ rates, currencies, onSave }) => {
  const [base, setBase] = useState(rates.base);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBase(rates.base || currencies[0] || '');
    setValues(Object.fromEntries(Object.entries(rates.rates).map(([k, v]) => [k, String(v)])));
  }, [rates, currencies]);

  const others = currencies.filter(c => c !== base);

  const save = async () => {
    const out: Record<string, number> = {};
    for (const code of others) {
      const raw = values[code] ?? '';
      if (raw.trim() === '') continue; // no rate: that currency stays out of converted totals
      const n = parse(raw);
      if (!Number.isFinite(n) || n <= 0) {
        setError(`Rate for ${code} must be a number greater than 0`);
        return;
      }
      out[code] = n;
    }
    setError(null);
    setSaving(true);
    await onSave(base, out);
    setSaving(false);
  };

  const field = 'w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 space-y-6">
      <div>
        <h3 className="text-xl font-black text-slate-100 uppercase italic">Exchange rates</h3>
        <p className="text-slate-400 text-sm leading-relaxed mt-2">
          Totals on Home and in Accounts are converted to the base currency, like HomeBank’s “Grand total”.
          Rates are not updated automatically.
        </p>
      </div>
      {currencies.length === 0 ? (
        <p className="text-sm text-slate-500">Add an account first.</p>
      ) : (
        <>
          <label className="block max-w-xs">
            <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Base currency</span>
            <select value={base} onChange={e => setBase(e.target.value)} className={field}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          {others.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {others.map(code => (
                <label key={code} className="block">
                  <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">1 {base} = ? {code}</span>
                  <input
                    inputMode="decimal"
                    value={values[code] ?? ''}
                    onChange={e => setValues(v => ({ ...v, [code]: e.target.value }))}
                    placeholder="e.g. 1.17"
                    className={field}
                  />
                </label>
              ))}
            </div>
          )}
          {error && <p role="alert" className="text-xs font-bold text-rose-400">{error}</p>}
          <button
            onClick={save}
            disabled={saving || !base}
            className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-[0.3em] disabled:opacity-40 hover:text-white"
          >
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </>
      )}
    </div>
  );
};
