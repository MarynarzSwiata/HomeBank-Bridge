/**
 * Period and currency helpers shared by Home, Budget and Reports.
 * All dates are local ISO strings (YYYY-MM-DD).
 */
import type { Account, Category, Transaction } from '../types';
import { parseDateForComparison } from './dateUtils';

export type PeriodId = 'this_month' | 'last_month' | 'last_30' | 'this_year' | 'last_year' | 'last_12';

export const PERIODS: { id: PeriodId; name: string }[] = [
  { id: 'this_month', name: 'This month' },
  { id: 'last_month', name: 'Last month' },
  { id: 'last_30', name: 'Last 30 days' },
  { id: 'this_year', name: 'This year' },
  { id: 'last_year', name: 'Last year' },
  { id: 'last_12', name: 'Last 12 months' },
];

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (year: number, month0: number) => `${year}-${pad(month0 + 1)}`;

export const periodRange = (id: PeriodId, now = new Date()): { from: string; to: string } => {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (id) {
    case 'this_month':
      return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) };
    case 'last_month':
      return { from: toISO(new Date(y, m - 1, 1)), to: toISO(new Date(y, m, 0)) };
    case 'last_30': {
      const from = new Date(now);
      from.setDate(from.getDate() - 29);
      return { from: toISO(from), to: toISO(now) };
    }
    case 'this_year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year':
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case 'last_12':
      return { from: toISO(new Date(y, m - 11, 1)), to: toISO(new Date(y, m + 1, 0)) };
  }
};

/** Sorted list of account currencies and the one used by most accounts (default for reports). */
export const currencyInfo = (accounts: Account[]) => {
  const counts = new Map<string, number>();
  accounts.forEach(a => counts.set(a.currency, (counts.get(a.currency) || 0) + 1));
  const currencies = Array.from(counts.keys()).sort();
  const defaultCurrency = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return { currencies, defaultCurrency };
};

export type FlowTransaction = Transaction & { iso: string };

/**
 * Income/expense transactions in one currency, excluding transfers between own accounts
 * (a transfer is neither income nor spending).
 */
export const flowTransactions = (
  transactions: Transaction[],
  accounts: Account[],
  currency: string
): FlowTransaction[] => {
  const currencyByAccount = new Map(accounts.map(a => [a.id, a.currency]));
  return transactions
    .filter(t => !t.transfer_id && currencyByAccount.get(t.account_id) === currency)
    .map(t => ({ ...t, iso: parseDateForComparison(t.date) }));
};

/** Map of category id -> { top-level name, full "Parent: Child" name, type } */
export const categoryLookup = (categories: Category[]) => {
  const map = new Map<number, { top: string; full: string; type: Category['type'] }>();
  categories.forEach(parent => {
    map.set(parent.id, { top: parent.name, full: parent.name, type: parent.type });
    parent.children?.forEach(child =>
      map.set(child.id, { top: parent.name, full: `${parent.name}: ${child.name}`, type: child.type })
    );
  });
  return map;
};

export const formatMoney = (v: number, hidden: boolean) =>
  hidden ? '••••' : v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
