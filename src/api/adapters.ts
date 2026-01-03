import type { ApiAccount, ApiCategory, ApiPayee, ApiTransaction, ApiExportLog } from './types';
import type { Account, Category, Payee, Transaction, ExportLog } from '../types';

/**
 * Adapters to convert API responses to frontend shape
 * (in case backend schema diverges from frontend expectations)
 */

export const adaptAccount = (apiAccount: ApiAccount): Account => ({
  id: apiAccount.id,
  name: apiAccount.name,
  currency: apiAccount.currency,
  initial_balance: apiAccount.initial_balance,
  current_balance: apiAccount.current_balance,
});

export const adaptCategory = (apiCategory: ApiCategory): Category => ({
  id: apiCategory.id,
  name: apiCategory.name,
  type: apiCategory.type,
  parent_id: apiCategory.parent_id,
  usage_count: apiCategory.usage_count,
  total_amount: apiCategory.total_amount,
  children: apiCategory.children?.map(adaptCategory),
});

export const adaptPayee = (apiPayee: ApiPayee): Payee => ({
  id: apiPayee.id,
  name: apiPayee.name,
  default_category_id: apiPayee.default_category_id,
  default_payment_type: apiPayee.default_payment_type,
  category_name: apiPayee.category_name,
  count: apiPayee.usage_count,
  total_amount: apiPayee.total_amount,
});

export const adaptTransaction = (apiTransaction: ApiTransaction): Transaction => ({
  id: apiTransaction.id,
  date: apiTransaction.date,
  payee: apiTransaction.payee || '',
  amount: apiTransaction.amount || 0,
  category_id: apiTransaction.category_id,
  category_name: apiTransaction.category_name || 'Unassigned',
  account_id: apiTransaction.account_id,
  account_name: apiTransaction.account_name || 'Unknown',
  payment_type: apiTransaction.payment_type || 0,
  memo: apiTransaction.memo || '',
  transfer_id: apiTransaction.transfer_id,
  exported: apiTransaction.exported || 0,
  export_log_id: apiTransaction.export_log_id,
});

export const adaptExportLog = (apiLog: ApiExportLog): ExportLog => ({
  id: apiLog.id,
  timestamp: apiLog.timestamp,
  filename: apiLog.filename,
  count: apiLog.count,
});
