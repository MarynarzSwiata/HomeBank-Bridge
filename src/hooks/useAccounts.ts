import { useState, useCallback } from 'react';
import { accountsService, ApiError } from '../api';
import { adaptAccount } from '../api/adapters';
import type { Account } from '../types';

interface UseAccountsResult {
  accounts: Account[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  refresh: () => Promise<void>;
  createAccount: (data: { name: string; currency: string; initialBalance?: number }) => Promise<number | null>;
  updateAccount: (id: number, data: { name?: string; currency?: string; initialBalance?: number }) => Promise<boolean>;
  deleteAccount: (id: number) => Promise<boolean>;
}

export function useAccounts(): UseAccountsResult {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await accountsService.getAll();
      setAccounts(data.map(adaptAccount));
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to load accounts';
      setError(message);
      throw err; // Propagate for useDataBootstrap
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAccount = useCallback(async (data: { name: string; currency: string; initialBalance?: number }): Promise<number | null> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      const result = await accountsService.create(data);
      await refresh().catch(() => {}); // Ignore refresh errors, data was saved
      return result.id;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to create account';
      setError(message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const updateAccount = useCallback(async (id: number, data: { name?: string; currency?: string; initialBalance?: number }): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await accountsService.update(id, data);
      await refresh().catch(() => {}); // Ignore refresh errors
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to update account';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const deleteAccount = useCallback(async (id: number): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await accountsService.delete(id);
      await refresh().catch(() => {}); // Ignore refresh errors
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to delete account';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  return {
    accounts,
    isLoading,
    error,
    isSaving,
    refresh,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}
