/**
 * Domain types for HomeBank-Bridge UI.
 * Components should import from this module only — never Api* types directly.
 */

export type CategoryType = '+' | '-' | ' ';

export type AccountType = 'bank' | 'checking' | 'savings' | 'cash' | 'creditcard' | 'asset' | 'liability';

/** 0 = none, 1 = cleared, 2 = reconciled (HomeBank semantics) */
export type TransactionStatus = 0 | 1 | 2;

export interface Account {
  id: number;
  name: string;
  currency: string;
  type: AccountType;
  closed: boolean;
  initial_balance: number;
  reconciled_balance: number;
  cleared_balance: number;
  today_balance: number;
  current_balance: number;
}

export interface AccountInput {
  name: string;
  currency: string;
  initialBalance?: number;
  type?: AccountType;
  closed?: boolean;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  parent_id: number | null;
  usage_count?: number;
  total_amount?: number;
  children?: Category[];
}

export interface Payee {
  id: number;
  name: string;
  default_category_id: number | null;
  default_payment_type: number | null;
  category_name?: string;
  count?: number;
  total_amount?: number;
}

export interface Transaction {
  id: number;
  date: string;
  payee: string;
  amount: number;
  category_id: number | null;
  category_name: string;
  account_id: number;
  account_name: string;
  payment_type: number;
  memo: string;
  transfer_id?: string;
  status: TransactionStatus;
  exported: number;
  export_log_id?: number | null;
}

export interface ExportLog {
  id: number;
  timestamp: string;
  filename: string;
  count: number;
}

export interface ImportPreview {
  type: 'categories' | 'transactions' | 'payees';
  rows: unknown[];
  filename: string;
}
