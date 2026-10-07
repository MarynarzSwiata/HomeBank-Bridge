import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Account, BudgetInput, BudgetRow, Category, Transaction } from '../../types';
import { budgetService, ApiError } from '../../api';
import { Alert } from '../common';
import {
  MONTH_NAMES,
  currencyInfo,
  flowTransactions,
  formatMoney,
  monthKey,
} from '../../utils/periodUtils';

/**
 * Monthly budget per category (HomeBank "Manage budget" + "Budget report" in one screen).
 * Budget amounts are positive: planned spending for expense categories,
 * planned income for income categories.
 */

interface BudgetViewProps {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  isAnonymized: boolean;
}

interface Row {
  category: Category;
  isChild: boolean;
  ownBudget: number;
  budget: number; // parent rows include their subcategories
  actual: number;
  hasChildBudget: boolean;
}

const parseAmount = (value: string) => {
  const n = parseFloat(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

export const BudgetView: React.FC<BudgetViewProps> = ({ accounts, transactions, categories, isAnonymized }) => {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month0: now.getMonth() };
  });
  const [onlyBudgeted, setOnlyBudgeted] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { currencies, defaultCurrency } = useMemo(() => currencyInfo(accounts), [accounts]);
  const [pickedCurrency, setPickedCurrency] = useState('');
  const currency = currencies.includes(pickedCurrency) ? pickedCurrency : defaultCurrency;

  const fmt = (v: number) => formatMoney(v, isAnonymized);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setRows(await budgetService.getAll());
    } catch (err) {
      setError(err instanceof ApiError ? `API Error (${err.status}): ${err.message}` : 'Failed to load budget');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Budget for one category in the selected month: a month override wins over "every month"
  const budgetFor = useCallback((categoryId: number) => {
    const own = rows.filter(r => r.category_id === categoryId);
    const specific = own.find(r => r.month === month.month0 + 1);
    return specific?.amount ?? own.find(r => r.month === 0)?.amount ?? 0;
  }, [rows, month.month0]);

  // Net actual amount per category for the selected month (signed, as stored)
  const actualByCategory = useMemo(() => {
    const key = monthKey(month.year, month.month0);
    const map = new Map<number | null, number>();
    flowTransactions(transactions, accounts, currency)
      .filter(t => t.iso.slice(0, 7) === key)
      .forEach(t => map.set(t.category_id, (map.get(t.category_id) || 0) + t.amount));
    return map;
  }, [transactions, accounts, currency, month]);

  // Expense categories count spending as positive; income categories count income as positive
  const actualFor = useCallback((c: Category) => {
    const raw = actualByCategory.get(c.id) || 0;
    return c.type === '+' ? raw : -raw;
  }, [actualByCategory]);

  const tableRows = useMemo(() => {
    const result: Row[] = [];
    const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    for (const parent of sorted) {
      const children = [...(parent.children || [])].sort((a, b) => a.name.localeCompare(b.name));
      const childRows: Row[] = children.map(child => {
        const own = budgetFor(child.id);
        return { category: child, isChild: true, ownBudget: own, budget: own, actual: actualFor(child), hasChildBudget: false };
      });
      const ownBudget = budgetFor(parent.id);
      const childBudget = childRows.reduce((s, r) => s + r.budget, 0);
      result.push({
        category: parent,
        isChild: false,
        ownBudget,
        budget: ownBudget + childBudget,
        actual: actualFor(parent) + childRows.reduce((s, r) => s + r.actual, 0),
        hasChildBudget: childBudget > 0,
      });
      result.push(...childRows);
    }
    if (!onlyBudgeted) return result;
    // Keep budgeted rows and the parents of budgeted children
    return result.filter(r => r.budget > 0 || r.category.id === editingId);
  }, [categories, budgetFor, actualFor, onlyBudgeted, editingId]);

  // Totals use each category's own budget/actual once (no double counting of parents)
  const totals = useMemo(() => {
    const t = { expenseBudget: 0, expenseActual: 0, incomeBudget: 0, incomeActual: 0 };
    const visit = (c: Category) => {
      if (c.type === '+') {
        t.incomeBudget += budgetFor(c.id);
        t.incomeActual += actualFor(c);
      } else {
        t.expenseBudget += budgetFor(c.id);
        t.expenseActual += actualFor(c);
      }
      c.children?.forEach(visit);
    };
    categories.forEach(visit);
    // Uncategorised spending still counts against the total
    const unassigned = actualByCategory.get(null) || 0;
    if (unassigned < 0) t.expenseActual += -unassigned;
    if (unassigned > 0) t.incomeActual += unassigned;
    return t;
  }, [categories, budgetFor, actualFor, actualByCategory]);

  const shiftMonth = (delta: number) => {
    setMonth(prev => {
      const d = new Date(prev.year, prev.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
  };

  const saveBudget = async (categoryId: number, input: BudgetInput) => {
    try {
      setError(null);
      await budgetService.save(categoryId, input);
      await load();
      setEditingId(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? `API Error (${err.status}): ${err.message}` : 'Failed to save budget');
      return false;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 max-w-6xl mx-auto">
      {error && <Alert variant="error" message={error} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="w-9 h-9 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-300 hover:text-white"
          >‹</button>
          <div className="min-w-[8.5rem] text-center text-sm font-black uppercase tracking-widest text-slate-100">
            {MONTH_NAMES[month.month0]} {month.year}
          </div>
          <button
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="w-9 h-9 rounded-xl bg-slate-900/50 border border-slate-800 text-slate-300 hover:text-white"
          >›</button>
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
        <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none md:ml-auto">
          <input
            type="checkbox"
            checked={onlyBudgeted}
            onChange={e => setOnlyBudgeted(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-indigo-600"
          />
          Only budgeted categories
        </label>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TotalTile label="Spending" budget={totals.expenseBudget} actual={totals.expenseActual} fmt={fmt} currency={currency} kind="expense" />
        <TotalTile label="Income" budget={totals.incomeBudget} actual={totals.incomeActual} fmt={fmt} currency={currency} kind="income" />
      </div>

      {/* Table */}
      <section className="p-4 md:p-8 bg-slate-900/40 border border-slate-800 rounded-[2rem]">
        {isLoading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Loading budget…</p>
        ) : categories.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">Create categories first (Taxonomy tab), then set a budget for them here.</p>
        ) : (
          <div>
            <div className="hidden md:grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_minmax(0,1.2fr)_auto] gap-3 px-3 pb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <div>Category</div>
              <div className="text-right">Budget</div>
              <div className="text-right">Actual</div>
              <div className="text-right">Remaining</div>
              <div>Progress</div>
              <div className="w-14" />
            </div>
            <ul className="divide-y divide-slate-800/60">
              {tableRows.map(row => (
                <li key={row.category.id}>
                  <BudgetRowView
                    row={row}
                    fmt={fmt}
                    isEditing={editingId === row.category.id}
                    onEdit={() => setEditingId(editingId === row.category.id ? null : row.category.id)}
                  />
                  {editingId === row.category.id && (
                    <BudgetEditor
                      categoryName={row.category.name}
                      existing={rows.filter(r => r.category_id === row.category.id)}
                      onCancel={() => setEditingId(null)}
                      onSave={input => saveBudget(row.category.id, input)}
                    />
                  )}
                </li>
              ))}
            </ul>
            {tableRows.length === 0 && (
              <p className="text-sm text-slate-500 py-8 text-center">No budgeted categories yet. Untick the filter and click “Set” on a category.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

const TotalTile: React.FC<{
  label: string;
  budget: number;
  actual: number;
  fmt: (v: number) => string;
  currency: string;
  kind: 'expense' | 'income';
}> = ({ label, budget, actual, fmt, currency, kind }) => {
  const over = kind === 'expense' && budget > 0 && actual > budget;
  return (
    <div className="p-6 bg-slate-900/40 border border-slate-800 rounded-[2rem] space-y-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-2xl font-black text-slate-100 tabular-nums">
        {fmt(actual)} <span className="text-sm text-slate-500">/ {fmt(budget)} {currency}</span>
      </div>
      <ProgressBar budget={budget} actual={actual} over={over} />
      {over && <OverLabel amount={fmt(actual - budget)} />}
    </div>
  );
};

const ProgressBar: React.FC<{ budget: number; actual: number; over: boolean }> = ({ budget, actual, over }) => {
  if (budget <= 0) return <div className="h-2 rounded-full bg-slate-800" aria-hidden="true" />;
  const pct = Math.min(100, Math.max(0, (actual / budget) * 100));
  return (
    <div className="h-2 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
      <div className={`h-full rounded-full ${over ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
    </div>
  );
};

const OverLabel: React.FC<{ amount: string }> = ({ amount }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-400">
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
    Over budget by {amount}
  </span>
);

const BudgetRowView: React.FC<{
  row: Row;
  fmt: (v: number) => string;
  isEditing: boolean;
  onEdit: () => void;
}> = ({ row, fmt, isEditing, onEdit }) => {
  const isIncome = row.category.type === '+';
  const remaining = row.budget - row.actual;
  const over = !isIncome && row.budget > 0 && row.actual > row.budget;
  const unbudgetedSpend = !isIncome && row.budget === 0 && row.actual > 0;

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.6fr)_1fr_1fr_1fr_minmax(0,1.2fr)_auto] gap-x-3 gap-y-1 items-center px-3 py-3 ${isEditing ? 'bg-indigo-500/5' : ''}`}>
      <div className={`min-w-0 ${row.isChild ? 'pl-5' : ''}`}>
        <div className={`truncate ${row.isChild ? 'text-sm text-slate-300' : 'text-sm font-black text-slate-100'}`}>
          {row.category.name}
          {isIncome && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-slate-500">income</span>}
        </div>
        {!row.isChild && row.hasChildBudget && (
          <div className="text-[10px] text-slate-500">incl. subcategories{row.ownBudget > 0 ? ` · own ${fmt(row.ownBudget)}` : ''}</div>
        )}
      </div>
      {/* Mobile: compact summary */}
      <div className="md:hidden text-right text-xs tabular-nums text-slate-300">
        {fmt(row.actual)} <span className="text-slate-500">/ {row.budget > 0 ? fmt(row.budget) : '—'}</span>
      </div>
      <div className="hidden md:block text-right text-sm tabular-nums text-slate-300">{row.budget > 0 ? fmt(row.budget) : '—'}</div>
      <div className="hidden md:block text-right text-sm tabular-nums text-slate-200 font-bold">{fmt(row.actual)}</div>
      <div className={`hidden md:block text-right text-sm tabular-nums ${over ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
        {row.budget > 0 ? fmt(remaining) : '—'}
      </div>
      <div className="col-span-2 md:col-span-1 space-y-1">
        <ProgressBar budget={row.budget} actual={row.actual} over={over} />
        {over && <OverLabel amount={fmt(row.actual - row.budget)} />}
        {unbudgetedSpend && <span className="text-[10px] font-bold text-slate-500">No budget set</span>}
      </div>
      <button
        onClick={onEdit}
        className="col-span-2 md:col-span-1 justify-self-start md:justify-self-end px-3 py-1.5 rounded-lg bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-indigo-600 hover:text-white w-14"
      >
        {isEditing ? 'Close' : row.ownBudget > 0 ? 'Edit' : 'Set'}
      </button>
    </div>
  );
};

const BudgetEditor: React.FC<{
  categoryName: string;
  existing: BudgetRow[];
  onCancel: () => void;
  onSave: (input: BudgetInput) => Promise<boolean>;
}> = ({ categoryName, existing, onCancel, onSave }) => {
  const everyMonth = existing.find(r => r.month === 0);
  const hasMonthly = existing.some(r => r.month > 0);
  const [mode, setMode] = useState<BudgetInput['mode']>(hasMonthly ? 'monthly' : 'same');
  const [amount, setAmount] = useState(everyMonth ? String(everyMonth.amount) : '');
  const [months, setMonths] = useState<string[]>(() =>
    Array.from({ length: 12 }, (_, i) => {
      const r = existing.find(x => x.month === i + 1);
      return r ? String(r.amount) : everyMonth ? String(everyMonth.amount) : '';
    })
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    let input: BudgetInput;
    if (mode === 'none') {
      input = { mode: 'none' };
    } else if (mode === 'same') {
      const v = amount.trim() === '' ? 0 : parseAmount(amount);
      if (!Number.isFinite(v) || v < 0) { setLocalError('Enter a positive amount'); return; }
      input = { mode: 'same', amount: v };
    } else {
      const values = months.map(m => (m.trim() === '' ? 0 : parseAmount(m)));
      if (values.some(v => !Number.isFinite(v) || v < 0)) { setLocalError('Every month must be empty or a positive amount'); return; }
      input = { mode: 'monthly', months: values };
    }
    setLocalError(null);
    setIsSaving(true);
    await onSave(input);
    setIsSaving(false);
  };

  const inputClass = 'w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="mx-3 mb-4 p-5 rounded-2xl border border-indigo-500/30 bg-slate-950/40 space-y-4">
      <div className="text-xs font-black uppercase tracking-widest text-slate-300">Budget for {categoryName}</div>
      <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-300" role="radiogroup">
        {([
          ['same', 'Same every month'],
          ['monthly', 'Different per month'],
          ['none', 'No budget'],
        ] as const).map(([id, label]) => (
          <label key={id} className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="budget-mode" checked={mode === id} onChange={() => setMode(id)} className="text-indigo-600" />
            {label}
          </label>
        ))}
      </div>
      {mode === 'same' && (
        <label className="block max-w-xs">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Amount per month</span>
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={`${inputClass} mt-1`} />
        </label>
      )}
      {mode === 'monthly' && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {MONTH_NAMES.map((name, i) => (
            <label key={name} className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{name}</span>
              <input
                inputMode="decimal"
                value={months[i]}
                onChange={e => setMonths(prev => prev.map((v, j) => (j === i ? e.target.value : v)))}
                placeholder="0"
                className={`${inputClass} mt-1`}
              />
            </label>
          ))}
        </div>
      )}
      {localError && <p className="text-xs font-bold text-rose-400">{localError}</p>}
      <div className="flex gap-3">
        <button
          onClick={submit}
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-40"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-5 py-2 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest">
          Cancel
        </button>
      </div>
    </div>
  );
};
