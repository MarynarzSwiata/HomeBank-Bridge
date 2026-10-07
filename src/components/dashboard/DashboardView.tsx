import React, { useMemo, useState } from 'react';
import type { Account, Category, Transaction } from '../../types';
import { ACCOUNT_TYPE_OPTIONS } from '../../constants';
import { CurrencyRates, convertedTotals, isInSummary } from '../../utils/currencyUtils';
import type { UseScheduledResult } from '../../hooks/useScheduled';
import { describeItem, PostAllDueButton } from '../scheduled/ScheduledView';
import { formatDateForDisplay } from '../../utils/dateUtils';
import {
  PERIODS,
  PeriodId,
  MONTH_NAMES,
  monthKey,
  periodRange,
  currencyInfo,
  categoryLookup,
  flowTransactions as getFlowTransactions,
  formatMoney,
  toISO,
} from '../../utils/periodUtils';

/**
 * Home screen modelled on HomeBank's main window:
 * account summary, top spending by category and income vs expense over time.
 */

interface DashboardViewProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  isAnonymized: boolean;
  onOpenAccount: (id: number) => void;
  onAddTransaction: () => void;
  onOpenGuide: () => void;
  scheduled: UseScheduledResult;
  dateFormat: string;
  onOpenScheduled: () => void;
  rates: CurrencyRates;
}

const UPCOMING_DAYS = 14;
const UPCOMING_LIMIT = 6;

// Chart series colours (validated for CVD separation and contrast on the dark surface).
// Colour follows the entity: income is always blue, expense always orange.
const INCOME_COLOR = '#3987e5';
const EXPENSE_COLOR = '#d95926';

const TOP_CATEGORIES = 8;
const MONTHS_IN_TREND = 6;

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts,
  transactions,
  categories,
  isAnonymized,
  onOpenAccount,
  onAddTransaction,
  onOpenGuide,
  scheduled,
  dateFormat,
  onOpenScheduled,
  rates,
}) => {
  const { currencies, defaultCurrency } = useMemo(() => currencyInfo(accounts), [accounts]);

  const [period, setPeriod] = useState<PeriodId>('this_month');
  const [pickedCurrency, setPickedCurrency] = useState('');
  const currency = currencies.includes(pickedCurrency) ? pickedCurrency : defaultCurrency;

  const fmt = (v: number) => formatMoney(v, isAnonymized);

  // HomeBank groups spending by top-level category
  const categoryInfo = useMemo(() => categoryLookup(categories), [categories]);

  const flowTransactions = useMemo(
    () => getFlowTransactions(transactions, accounts, currency, 'report'),
    [transactions, accounts, currency]
  );

  const range = periodRange(period);

  const periodStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();
    for (const t of flowTransactions) {
      if (t.iso < range.from || t.iso > range.to) continue;
      if (t.amount > 0) income += t.amount;
      if (t.amount < 0) {
        expense += -t.amount;
        const name = (t.category_id && categoryInfo.get(t.category_id)?.top) || 'Unassigned';
        byCategory.set(name, (byCategory.get(name) || 0) + -t.amount);
      }
    }
    const sorted = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, TOP_CATEGORIES);
    const rest = sorted.slice(TOP_CATEGORIES).reduce((sum, [, v]) => sum + v, 0);
    if (rest > 0) top.push(['Other', rest]);
    return { income, expense, net: income - expense, topSpending: top };
  }, [flowTransactions, range.from, range.to, categoryInfo]);

  // Income vs expense for the last N calendar months
  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: MONTHS_IN_TREND }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS_IN_TREND - 1 - i), 1);
      return {
        key: monthKey(d.getFullYear(), d.getMonth()),
        label: `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        income: 0,
        expense: 0,
      };
    });
    const index = new Map(months.map((m, i) => [m.key, i]));
    for (const t of flowTransactions) {
      const i = index.get(t.iso.slice(0, 7));
      if (i === undefined) continue;
      if (t.amount > 0) months[i].income += t.amount;
      else months[i].expense += -t.amount;
    }
    return months;
  }, [flowTransactions]);

  // Like HomeBank's summary: hide closed accounts and those excluded from the summary
  const openAccounts = accounts.filter(isInSummary);
  const hiddenCount = accounts.length - openAccounts.length;
  const accountGroups = ACCOUNT_TYPE_OPTIONS
    .map(t => ({ label: t.name, items: openAccounts.filter(a => a.type === t.id) }))
    .filter(g => g.items.length > 0)
    .map(g => ({ ...g, converted: rates.base ? convertedTotals(g.items, rates) : null }));
  const grandTotal = rates.base ? convertedTotals(openAccounts, rates) : null;

  const totalsByCurrency = useMemo(() => {
    const totals = new Map<string, { reconciled: number; today: number; future: number }>();
    openAccounts.forEach(a => {
      const t = totals.get(a.currency) || { reconciled: 0, today: 0, future: 0 };
      t.reconciled += a.reconciled_balance;
      t.today += a.today_balance;
      t.future += a.current_balance;
      totals.set(a.currency, t);
    });
    return Array.from(totals.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [openAccounts]);

  if (accounts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem] space-y-6">
        <p className="text-lg font-black uppercase tracking-widest text-slate-400">Welcome</p>
        <p className="text-sm text-slate-500">Create an account first, then add transactions to see your summary here.</p>
        <button
          onClick={onOpenGuide}
          className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.3em] text-[10px]"
        >
          How to use
        </button>
      </div>
    );
  }

  const maxCategory = periodStats.topSpending[0]?.[1] || 0;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 max-w-6xl mx-auto">
      {/* Filters: one row above all charts */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${
                period === p.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
        {currencies.length > 1 && (
          <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Currency
            <select
              value={currency}
              onChange={e => setPickedCurrency(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <button
          onClick={onAddTransaction}
          className="md:ml-auto px-5 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all"
        >
          + Add transaction
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile label="Income" value={fmt(periodStats.income)} currency={currency} swatch={INCOME_COLOR} />
        <StatTile label="Expense" value={fmt(periodStats.expense)} currency={currency} swatch={EXPENSE_COLOR} />
        <StatTile
          label="Balance"
          value={`${periodStats.net >= 0 ? '+' : '−'}${fmt(Math.abs(periodStats.net))}`}
          currency={currency}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top spending */}
        <section className="p-6 md:p-8 bg-slate-900/40 border border-slate-800 rounded-[2rem] space-y-5">
          <header>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">Top spending</h2>
            <p className="text-[10px] font-bold text-slate-500 mt-1">
              By category · {PERIODS.find(p => p.id === period)?.name} · {currency}
            </p>
          </header>
          {periodStats.topSpending.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">No expenses in this period.</p>
          ) : (
            <ul className="space-y-3">
              {periodStats.topSpending.map(([name, value]) => {
                const share = periodStats.expense ? (value / periodStats.expense) * 100 : 0;
                const width = maxCategory ? Math.max((value / maxCategory) * 100, 1) : 0;
                return (
                  <li
                    key={name}
                    className="grid grid-cols-[minmax(0,7rem)_1fr_auto] md:grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg hover:bg-slate-800/40 px-1 py-0.5"
                    title={`${name}: ${fmt(value)} ${currency} (${share.toFixed(1)}%)`}
                  >
                    <span className="text-[11px] font-bold text-slate-300 truncate">{name}</span>
                    <span className="h-4 flex items-center" aria-hidden="true">
                      <span
                        className="h-3.5 block"
                        style={{ width: `${width}%`, background: EXPENSE_COLOR, borderRadius: '0 4px 4px 0' }}
                      />
                    </span>
                    <span className="text-[11px] font-bold text-slate-200 tabular-nums text-right whitespace-nowrap">
                      {fmt(value)} <span className="text-slate-500">{share.toFixed(0)}%</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Monthly trend */}
        <section className="p-6 md:p-8 bg-slate-900/40 border border-slate-800 rounded-[2rem] space-y-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">Income vs expense</h2>
              <p className="text-[10px] font-bold text-slate-500 mt-1">Last {MONTHS_IN_TREND} months · {currency}</p>
            </div>
            <div className="flex gap-4 text-[10px] font-bold text-slate-400" aria-hidden="true">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_COLOR }} />Income</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: EXPENSE_COLOR }} />Expense</span>
            </div>
          </header>
          <MonthlyChart months={monthlyTrend} fmt={fmt} currency={currency} />
        </section>
      </div>

      <UpcomingScheduled scheduled={scheduled} dateFormat={dateFormat} fmt={fmt} onOpenScheduled={onOpenScheduled} />

      {/* Account summary */}
      <section className="p-6 md:p-8 bg-slate-900/40 border border-slate-800 rounded-[2rem] space-y-4">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">Your accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                <th className="text-left py-2 font-black">Account</th>
                <th className="hidden sm:table-cell text-right py-2 font-black">Reconciled</th>
                <th className="hidden sm:table-cell text-right py-2 font-black">Today</th>
                <th className="text-right py-2 font-black">Future</th>
              </tr>
            </thead>
            {accountGroups.map(group => (
              <tbody key={group.label}>
                <tr>
                  <th colSpan={4} className="text-left pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400/70">
                    {group.label}
                  </th>
                </tr>
                {group.items.map(a => (
                  <tr
                    key={a.id}
                    onClick={() => onOpenAccount(a.id)}
                    className="cursor-pointer hover:bg-slate-800/40 border-t border-slate-800/60"
                  >
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onOpenAccount(a.id); }}
                        className="font-bold text-slate-100 hover:text-indigo-300 text-left"
                      >
                        {a.name}
                      </button>
                      <span className="ml-2 text-[10px] text-slate-500">{a.currency}</span>
                    </td>
                    <BalanceCell value={a.reconciled_balance} fmt={fmt} wideOnly />
                    <BalanceCell value={a.today_balance} fmt={fmt} wideOnly />
                    <BalanceCell value={a.current_balance} fmt={fmt} strong />
                  </tr>
                ))}
                {group.converted && (
                  <tr className="border-t border-slate-700/80">
                    <td className="py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Total {rates.base}{group.converted.missing.length > 0 ? ` (without ${group.converted.missing.join(', ')})` : ''}
                    </td>
                    <BalanceCell value={group.converted.totals.reconciled} fmt={fmt} wideOnly />
                    <BalanceCell value={group.converted.totals.today} fmt={fmt} wideOnly />
                    <BalanceCell value={group.converted.totals.future} fmt={fmt} strong />
                  </tr>
                )}
              </tbody>
            ))}
            <tfoot>
              {grandTotal && (
                <tr className="border-t-2 border-slate-600">
                  <td className="py-3 text-[11px] font-black uppercase tracking-widest text-slate-200">
                    Grand total {rates.base}{grandTotal.missing.length > 0 ? ` (without ${grandTotal.missing.join(', ')})` : ''}
                  </td>
                  <BalanceCell value={grandTotal.totals.reconciled} fmt={fmt} wideOnly />
                  <BalanceCell value={grandTotal.totals.today} fmt={fmt} wideOnly />
                  <BalanceCell value={grandTotal.totals.future} fmt={fmt} strong />
                </tr>
              )}
              {!grandTotal && totalsByCurrency.map(([cur, t]) => (
                <tr key={cur} className="border-t-2 border-slate-700">
                  <td className="py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">Total {cur}</td>
                  <BalanceCell value={t.reconciled} fmt={fmt} wideOnly />
                  <BalanceCell value={t.today} fmt={fmt} wideOnly />
                  <BalanceCell value={t.future} fmt={fmt} strong />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
        <p className="text-[10px] font-bold text-slate-500">
          {hiddenCount > 0 ? `${hiddenCount} closed or hidden account(s) not shown. ` : ''}
          {rates.base
            ? `Totals converted to ${rates.base} with the exchange rates in Options.`
            : 'Set a base currency in Options to see totals converted to one currency.'}
        </p>
      </section>
    </div>
  );
};

const StatTile: React.FC<{ label: string; value: string; currency: string; swatch?: string }> = ({ label, value, currency, swatch }) => (
  <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-[2rem]">
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
      {swatch && <span className="w-2.5 h-2.5 rounded-sm" style={{ background: swatch }} aria-hidden="true" />}
      {label}
    </div>
    <div className="mt-2 text-2xl font-black text-slate-100 tabular-nums">
      {value} <span className="text-xs text-slate-500">{currency}</span>
    </div>
  </div>
);

const BalanceCell: React.FC<{ value: number; fmt: (v: number) => string; strong?: boolean; wideOnly?: boolean }> = ({ value, fmt, strong, wideOnly }) => (
  <td className={`py-2.5 text-right tabular-nums ${wideOnly ? 'hidden sm:table-cell' : ''} ${strong ? 'font-black' : 'font-semibold'} ${value < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
    {fmt(value)}
  </td>
);

interface MonthPoint { key: string; label: string; income: number; expense: number }

/** Grouped columns (income, expense) per month, one shared y-axis, hover tooltip and a table for screen readers. */
const MonthlyChart: React.FC<{ months: MonthPoint[]; fmt: (v: number) => string; currency: string }> = ({ months, fmt, currency }) => {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 240;
  const M = { top: 12, right: 8, bottom: 26, left: 8 };
  const plotH = H - M.top - M.bottom;
  const band = (W - M.left - M.right) / months.length;
  const barW = Math.min(20, band / 3);
  const GAP = 2;
  const max = Math.max(1, ...months.map(m => Math.max(m.income, m.expense)));
  const y = (v: number) => (v / max) * plotH;
  const baseline = M.top + plotH;

  // Column with a 4px rounded top and a square base
  const column = (x: number, h: number) => {
    if (h <= 0) return '';
    const r = Math.min(4, h, barW / 2);
    const top = baseline - h;
    return `M${x},${baseline} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${baseline} Z`;
  };

  const hovered = hover !== null ? months[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Income and expense per month in ${currency}`}>
        {[0.5, 1].map(f => (
          <line key={f} x1={M.left} x2={W - M.right} y1={baseline - plotH * f} y2={baseline - plotH * f} stroke="#1e293b" strokeWidth={1} />
        ))}
        <line x1={M.left} x2={W - M.right} y1={baseline} y2={baseline} stroke="#334155" strokeWidth={1} />
        {months.map((m, i) => {
          const cx = M.left + band * i + band / 2;
          return (
            <g key={m.key}>
              {hover === i && <rect x={cx - band / 2} y={M.top} width={band} height={plotH} fill="#ffffff" opacity={0.04} />}
              <path d={column(cx - barW - GAP / 2, y(m.income))} fill={INCOME_COLOR} />
              <path d={column(cx + GAP / 2, y(m.expense))} fill={EXPENSE_COLOR} />
              <text x={cx} y={H - 8} textAnchor="middle" fontSize={11} fill="#94a3b8" fontWeight={700}>{m.label}</text>
              {/* Hit target: the whole month band */}
              <rect
                x={cx - band / 2}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
      {hovered && hover !== null && (
        <div
          className="absolute top-0 pointer-events-none px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 shadow-xl text-[11px] font-bold text-slate-200 whitespace-nowrap"
          style={{
            left: `${((hover + 0.5) / months.length) * 100}%`,
            transform: `translateX(${hover < months.length / 2 ? '0' : '-100%'})`,
          }}
        >
          <div className="text-slate-400 mb-1">{hovered.label}</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: INCOME_COLOR }} />Income {fmt(hovered.income)}</div>
          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: EXPENSE_COLOR }} />Expense {fmt(hovered.expense)}</div>
          <div className="text-slate-400 mt-1">Balance {fmt(hovered.income - hovered.expense)}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>Income and expense per month ({currency})</caption>
        <thead><tr><th>Month</th><th>Income</th><th>Expense</th></tr></thead>
        <tbody>
          {months.map(m => (
            <tr key={m.key}><td>{m.label}</td><td>{fmt(m.income)}</td><td>{fmt(m.expense)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Due and upcoming scheduled transactions, like HomeBank's home "scheduled" panel */
const UpcomingScheduled: React.FC<{
  scheduled: UseScheduledResult;
  dateFormat: string;
  fmt: (v: number) => string;
  onOpenScheduled: () => void;
}> = ({ scheduled, dateFormat, fmt, onOpenScheduled }) => {
  const today = toISO(new Date());
  const horizonDate = new Date();
  horizonDate.setDate(horizonDate.getDate() + UPCOMING_DAYS);
  const horizon = toISO(horizonDate);
  const upcoming = scheduled.items.filter(i => !i.finished && i.next_date <= horizon);
  const dueCount = upcoming.filter(i => i.next_date <= today).length;

  if (scheduled.items.length === 0) return null;

  return (
    <section className="p-6 md:p-8 bg-slate-900/40 border border-slate-800 rounded-[2rem] space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">Scheduled</h2>
          <p className="text-[10px] font-bold text-slate-500 mt-1">Due now and in the next {UPCOMING_DAYS} days</p>
        </div>
        <div className="flex gap-2 md:ml-auto">
          {dueCount > 0 && <PostAllDueButton scheduled={scheduled} dueCount={dueCount} />}
          <button onClick={onOpenScheduled} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:text-white">
            Manage
          </button>
        </div>
      </header>
      {scheduled.error && <p className="text-xs font-bold text-rose-400">{scheduled.error}</p>}
      {upcoming.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing due in the next {UPCOMING_DAYS} days.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {upcoming.slice(0, UPCOMING_LIMIT).map(item => {
            const due = item.next_date <= today;
            return (
              <li key={item.id} className="py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className={`w-24 text-xs font-black tabular-nums ${due ? 'text-amber-300' : 'text-slate-300'}`}>
                  {formatDateForDisplay(item.next_date, dateFormat)}
                </span>
                <span className="flex-1 min-w-[8rem] text-sm font-bold text-slate-100 truncate">
                  {describeItem(item)}
                  {due && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-amber-300">{item.next_date < today ? 'Overdue' : 'Due'}</span>}
                </span>
                <span className="text-sm font-bold tabular-nums text-slate-200">
                  {item.type === 'expense' ? '−' : item.type === 'income' ? '+' : ''}{fmt(item.amount)} <span className="text-[10px] text-slate-500">{item.currency}</span>
                </span>
                <button
                  onClick={() => scheduled.post(item.id)}
                  disabled={scheduled.isSaving}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/40 disabled:opacity-40"
                >
                  Post
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {upcoming.length > UPCOMING_LIMIT && (
        <button onClick={onOpenScheduled} className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
          + {upcoming.length - UPCOMING_LIMIT} more
        </button>
      )}
    </section>
  );
};
