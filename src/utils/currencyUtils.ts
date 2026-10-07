import type { Account } from '../types';

/**
 * Exchange rates as in HomeBank: rate = units of a currency per 1 unit of the base currency
 * (e.g. base EUR, USD 1.17 means 1 EUR = 1.17 USD).
 */
export interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
}

export const EMPTY_RATES: CurrencyRates = { base: '', rates: {} };

/** Amount in the base currency, or null when no rate is known */
export const toBase = (amount: number, currency: string, r: CurrencyRates): number | null => {
  if (!r.base || currency === r.base) return currency === r.base ? amount : null;
  const rate = r.rates[currency];
  return rate && rate > 0 ? amount / rate : null;
};

/** Accounts HomeBank shows in its summary: not closed and not excluded from the summary */
export const isInSummary = (a: Account) => !a.closed && !a.no_summary;

export interface BalanceTotals {
  reconciled: number;
  today: number;
  future: number;
}

/**
 * Totals in the base currency. `missing` lists currencies without a rate
 * (those accounts are left out of the converted total).
 */
export const convertedTotals = (accounts: Account[], r: CurrencyRates) => {
  const totals: BalanceTotals = { reconciled: 0, today: 0, future: 0 };
  const missing = new Set<string>();
  for (const a of accounts) {
    const rec = toBase(a.reconciled_balance, a.currency, r);
    const tod = toBase(a.today_balance, a.currency, r);
    const fut = toBase(a.current_balance, a.currency, r);
    if (rec === null || tod === null || fut === null) {
      missing.add(a.currency);
      continue;
    }
    totals.reconciled += rec;
    totals.today += tod;
    totals.future += fut;
  }
  return { totals, missing: Array.from(missing) };
};
