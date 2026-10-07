import React, { useMemo, useState } from 'react';
import type { Account, Category, Transaction } from '../../types';
import {
  PERIODS,
  PeriodId,
  MONTH_NAMES,
  categoryLookup,
  currencyInfo,
  flowTransactions,
  formatMoney,
  monthKey,
  periodRange,
} from '../../utils/periodUtils';
import { sanitizeCSVField, triggerDownload } from '../../utils/exportUtils';
import { splitTags } from '../../utils/tagUtils';
import { BalanceReport } from './BalanceReport';
import type { CurrencyRates } from '../../utils/currencyUtils';

/**
 * Statistics report modelled on HomeBank's "Statistics" and "Trend time" reports:
 * totals of income or expense grouped by category, subcategory, payee or month.
 */

interface ReportsViewProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  isAnonymized: boolean;
  rates?: CurrencyRates;
}

type GroupBy = 'category' | 'subcategory' | 'payee' | 'tag' | 'month';
type Flow = 'expense' | 'income';

const GROUPS: { id: GroupBy; name: string }[] = [
  { id: 'category', name: 'Category' },
  { id: 'subcategory', name: 'Subcategory' },
  { id: 'payee', name: 'Payee' },
  { id: 'tag', name: 'Tag' },
  { id: 'month', name: 'Month' },
];

// Colour follows the entity (same as Home): income blue, expense orange
const FLOW_COLOR: Record<Flow, string> = { income: '#2a78d6', expense: '#eb6834' };

const StatisticsReport: React.FC<ReportsViewProps> = ({ accounts, transactions, categories, isAnonymized }) => {
  const [period, setPeriod] = useState<PeriodId | 'custom'>('this_year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [flow, setFlow] = useState<Flow>('expense');
  const [accountId, setAccountId] = useState('');

  const { currencies, defaultCurrency } = useMemo(() => currencyInfo(accounts), [accounts]);
  const [pickedCurrency, setPickedCurrency] = useState('');
  // A single selected account fixes the currency
  const selectedAccount = accounts.find(a => String(a.id) === accountId);
  const currency = selectedAccount?.currency || (currencies.includes(pickedCurrency) ? pickedCurrency : defaultCurrency);

  const fmt = (v: number) => formatMoney(v, isAnonymized);
  const categoryInfo = useMemo(() => categoryLookup(categories), [categories]);

  const range = useMemo(() => {
    if (period !== 'custom') return periodRange(period);
    return { from: customFrom || '0000-01-01', to: customTo || '9999-12-31' };
  }, [period, customFrom, customTo]);

  const report = useMemo(() => {
    const totals = new Map<string, number>();
    let total = 0;
    let count = 0;
    for (const t of flowTransactions(transactions, accounts, currency, accountId ? undefined : 'report')) {
      if (t.iso < range.from || t.iso > range.to) continue;
      if (accountId && String(t.account_id) !== accountId) continue;
      const value = flow === 'expense' ? -t.amount : t.amount;
      if (value <= 0) continue;
      total += value;
      count += 1;
      // A transaction with several tags counts towards each of them (as in HomeBank)
      if (groupBy === 'tag') {
        const tags = splitTags(t.tags);
        (tags.length ? tags : ['(no tag)']).forEach(tag => totals.set(tag, (totals.get(tag) || 0) + value));
        continue;
      }
      const info = t.category_id ? categoryInfo.get(t.category_id) : undefined;
      const key =
        groupBy === 'category' ? info?.top || 'Unassigned'
        : groupBy === 'subcategory' ? info?.full || 'Unassigned'
        : groupBy === 'payee' ? t.payee?.trim() || '(no payee)'
        : t.iso.slice(0, 7);
      totals.set(key, (totals.get(key) || 0) + value);
    }

    let rows: { key: string; label: string; value: number }[];
    if (groupBy === 'month') {
      // Chronological, including months with nothing (a gap is information)
      const keys = Array.from(totals.keys()).sort();
      const first = period === 'custom' && !customFrom ? keys[0] : range.from.slice(0, 7);
      const last = period === 'custom' && !customTo ? keys[keys.length - 1] : range.to.slice(0, 7);
      rows = [];
      if (first && last) {
        let [y, m] = first.split('-').map(Number);
        const [ly, lm] = last.split('-').map(Number);
        while ((y < ly || (y === ly && m <= lm)) && rows.length < 240) {
          const key = monthKey(y, m - 1);
          rows.push({ key, label: `${MONTH_NAMES[m - 1]} ${y}`, value: totals.get(key) || 0 });
          m += 1;
          if (m > 12) { m = 1; y += 1; }
        }
      }
    } else {
      rows = Array.from(totals.entries())
        .map(([key, value]) => ({ key, label: key, value }))
        .sort((a, b) => b.value - a.value);
    }
    return { rows, total, count };
  }, [transactions, accounts, currency, range, accountId, flow, groupBy, categoryInfo, period, customFrom, customTo]);

  const max = Math.max(0, ...report.rows.map(r => r.value));
  const monthsWithData = report.rows.filter(r => r.value > 0).length;

  const exportCsv = () => {
    const header = [GROUPS.find(g => g.id === groupBy)?.name || 'Group', `Amount (${currency})`, 'Share %'];
    const lines = report.rows.map(r => [
      sanitizeCSVField(r.label),
      r.value.toFixed(2),
      report.total ? ((r.value / report.total) * 100).toFixed(1) : '0',
    ]);
    lines.push(['Total', report.total.toFixed(2), '100']);
    const csv = [header, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const from = range.from.startsWith('0000') ? 'start' : range.from;
    const to = range.to.startsWith('9999') ? 'today' : range.to;
    triggerDownload(csv, `report_${flow}_by_${groupBy}_${from}_${to}.csv`);
  };

  const selectClass = 'bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500';
  const labelClass = 'flex flex-col gap-1 text-[13px] font-medium text-slate-500';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 max-w-6xl mx-auto">
      {/* Filters: one row above the report */}
      <div className="p-5 bg-slate-900 border border-slate-800 rounded-[2rem] flex flex-wrap items-end gap-4">
        <label className={labelClass}>
          Show
          <select value={flow} onChange={e => setFlow(e.target.value as Flow)} className={selectClass}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label className={labelClass}>
          Group by
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)} className={selectClass}>
            {GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Period
          <select value={period} onChange={e => setPeriod(e.target.value as PeriodId | 'custom')} className={selectClass}>
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="custom">Custom range…</option>
          </select>
        </label>
        {period === 'custom' && (
          <>
            <label className={labelClass}>
              From
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={selectClass} />
            </label>
            <label className={labelClass}>
              To
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={selectClass} />
            </label>
          </>
        )}
        <label className={labelClass}>
          Account
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectClass}>
            <option value="">All accounts</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency}){a.closed ? ' – closed' : ''}</option>
            ))}
          </select>
        </label>
        {!selectedAccount && currencies.length > 1 && (
          <label className={labelClass}>
            Currency
            <select value={currency} onChange={e => setPickedCurrency(e.target.value)} className={selectClass}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <button
          onClick={exportCsv}
          disabled={report.rows.length === 0}
          className="md:ml-auto px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-100 disabled:opacity-30"
        >
          Export CSV
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Tile label={`Total ${flow}`} value={`${fmt(report.total)} ${currency}`} swatch={FLOW_COLOR[flow]} />
        <Tile label="Transactions" value={String(report.count)} />
        <Tile
          label={groupBy === 'month' ? 'Average per month' : 'Groups'}
          value={groupBy === 'month'
            ? `${fmt(report.rows.length ? report.total / report.rows.length : 0)} ${currency}`
            : String(report.rows.length)}
        />
      </div>

      {/* Result */}
      <section className="p-4 md:p-8 bg-slate-900 border border-slate-800 rounded-[2rem] space-y-4">
        <header>
          <h2 className="text-[15px] font-semibold text-slate-100">
            {flow === 'expense' ? 'Expense' : 'Income'} by {GROUPS.find(g => g.id === groupBy)?.name.toLowerCase()}
          </h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            {range.from.startsWith('0000') ? 'Start' : range.from} → {range.to.startsWith('9999') ? 'today' : range.to} · {currency}
            {selectedAccount ? ` · ${selectedAccount.name}` : ''} · transfers between accounts excluded
          </p>
        </header>
        {report.total === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">No {flow} in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sr-only md:table-header-group md:not-sr-only">
              <tr className="text-[13px] font-medium text-slate-500">
                <th className="text-left py-2 font-black">{GROUPS.find(g => g.id === groupBy)?.name}</th>
                <th className="hidden md:table-cell py-2" aria-hidden="true" />
                <th className="text-right py-2 font-black">Amount</th>
                <th className="text-right py-2 font-black w-16">Share</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map(r => {
                const share = report.total ? (r.value / report.total) * 100 : 0;
                return (
                  <tr key={r.key} className="border-t border-slate-800/60 hover:bg-slate-800/30" title={`${r.label}: ${fmt(r.value)} ${currency} (${share.toFixed(1)}%)`}>
                    <td className="py-2 pr-3 max-w-[10rem] md:max-w-none">
                      <div className="truncate font-bold text-slate-200">{r.label}</div>
                      {/* Mobile: bar under the label */}
                      <div className="md:hidden mt-1 h-2" aria-hidden="true">
                        <div className="h-2" style={{ width: `${max ? (r.value / max) * 100 : 0}%`, background: FLOW_COLOR[flow], borderRadius: '0 4px 4px 0' }} />
                      </div>
                    </td>
                    <td className="hidden md:table-cell py-2 w-[40%]" aria-hidden="true">
                      <div className="h-3.5" style={{ width: `${max ? Math.max((r.value / max) * 100, r.value > 0 ? 0.5 : 0) : 0}%`, background: FLOW_COLOR[flow], borderRadius: '0 4px 4px 0' }} />
                    </td>
                    <td className="py-2 text-right tabular-nums font-bold text-slate-100 whitespace-nowrap">{fmt(r.value)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-500">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-700">
                <td className="py-2.5 text-[13px] font-medium text-slate-500">Total</td>
                <td className="hidden md:table-cell" />
                <td className="py-2.5 text-right tabular-nums font-black text-slate-100 whitespace-nowrap">{fmt(report.total)}</td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">100%</td>
              </tr>
            </tfoot>
          </table>
        )}
        {groupBy === 'tag' && report.total > 0 && (
          <p className="text-[10px] font-bold text-slate-500">A transaction with several tags is counted under each tag, so rows can add up to more than the total.</p>
        )}
        {groupBy === 'month' && report.total > 0 && monthsWithData < report.rows.length && (
          <p className="text-[10px] font-bold text-slate-500">Months without any {flow} are shown as 0.</p>
        )}
      </section>
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string; swatch?: string }> = ({ label, value, swatch }) => (
  <div className="p-6 bg-slate-900 border border-slate-800 rounded-[2rem]">
    <div className="flex items-center gap-2 text-[13px] font-medium text-slate-500">
      {swatch && <span className="w-2.5 h-2.5 rounded-sm" style={{ background: swatch }} aria-hidden="true" />}
      {label}
    </div>
    <div className="mt-2 text-xl font-black text-slate-100 tabular-nums">{value}</div>
  </div>
);

/** Reports tab: statistics (totals by group) or balance over time */
export const ReportsView: React.FC<ReportsViewProps> = (props) => {
  const [view, setView] = useState<'stats' | 'balance'>('stats');
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex gap-2" role="tablist" aria-label="Report type">
        {([['stats', 'Statistics'], ['balance', 'Balance over time']] as const).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
              view === id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {view === 'stats'
        ? <StatisticsReport {...props} />
        : <BalanceReport accounts={props.accounts} transactions={props.transactions} isAnonymized={props.isAnonymized} rates={props.rates || { base: '', rates: {} }} />}
    </div>
  );
};
