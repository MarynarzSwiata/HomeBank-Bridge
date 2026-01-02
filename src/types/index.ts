/**
 * Domain types for HomeBank-Bridge UI.
 * Components should import from this module only — never Api* types directly.
 */

export type CategoryType = '+' | '-' | ' ';

export interface Account {
  id: number;
  name: string;
  currency: string;
  initial_balance: number;
  current_balance: number;
}

export interface Category {
  id: number;
  name: string;
  type: CategoryType;
  parent_id: number | null;
  usage_count?: number;
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
