import { useState, useCallback, useRef } from 'react';
import { transactionsService, ApiError } from '../api';
import { adaptTransaction } from '../api/adapters';
import type { Transaction } from '../types';

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface TransactionFilters {
  accountId?: number;
  from?: string;
  to?: string;
}

interface CreateTransactionData {
  type: TransactionType;
  accountId: number;
  amount: number; // Unsigned for create
  date: string;
  payee?: string;
  memo?: string;
  categoryId?: number;
  paymentType?: number;
  targetAccountId?: number; // For transfers
  targetAmount?: number; // For mixed-currency transfers
}

interface UpdateTransactionData {
  amount?: number; // Signed for update
  date?: string;
  payee?: string;
  memo?: string;
  categoryId?: number;
  paymentType?: number;
  accountId?: number;
  targetAccountId?: number;
  targetAmount?: number;
}

export interface UseTransactionsResult {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  currentFilters: TransactionFilters | undefined;
  refresh: (filters?: TransactionFilters) => Promise<void>;
  createTransaction: (data: CreateTransactionData) => Promise<{ id?: number; transferId?: string } | null>;
  updateTransaction: (id: number, data: UpdateTransactionData) => Promise<boolean>;
  deleteTransaction: (id: number) => Promise<boolean>;
}

export function useTransactions(): UseTransactionsResult {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Remember last used filters for refreshing after mutations
  const lastFiltersRef = useRef<TransactionFilters | undefined>(undefined);

  const refresh = useCallback(async (filters?: TransactionFilters) => {
    // Store filters for future mutations
    if (filters !== undefined) {
      lastFiltersRef.current = filters;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      const data = await transactionsService.getAll(lastFiltersRef.current);
      setTransactions(data.map(adaptTransaction));
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to load transactions';
      setError(message);
      throw err; // Propagate for useDataBootstrap
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTransaction = useCallback(async (data: CreateTransactionData): Promise<{ id?: number; transferId?: string } | null> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors

      // API expects: unsigned amount + type
      const result = await transactionsService.create({
        type: data.type,
        accountId: data.accountId,
        amount: data.amount,
        date: data.date,
        payee: data.payee,
        memo: data.memo,
        categoryId: data.categoryId,
        paymentType: data.paymentType,
        targetAccountId: data.targetAccountId,
        targetAmount: data.targetAmount,
      });
      // Refresh with preserved filters
      await refresh().catch(() => {});
      return { id: result.id, transferId: result.transferId };
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to create transaction';
      setError(message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const updateTransaction = useCallback(async (id: number, data: UpdateTransactionData): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      // API expects: signed amount for update
      await transactionsService.update(id, data);
      // Refresh with preserved filters
      await refresh().catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to update transaction';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const deleteTransaction = useCallback(async (id: number): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await transactionsService.delete(id);
      // Refresh with preserved filters
      await refresh().catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to delete transaction';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  return {
    transactions,
    isLoading,
    error,
    isSaving,
    currentFilters: lastFiltersRef.current,
    refresh,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
