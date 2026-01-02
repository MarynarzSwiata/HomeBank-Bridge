import { useState, useCallback } from 'react';
import { payeesService, ApiError } from '../api';
import { adaptPayee } from '../api/adapters';
import type { Payee } from '../types';

interface UsePayeesResult {
  payees: Payee[];
  isLoading: boolean;
  error: string | null;
  isSaving: boolean;
  refresh: () => Promise<void>;
  createPayee: (data: { name: string; defaultCategoryId?: number | null; defaultPaymentType?: number | null }) => Promise<number | null>;
  updatePayee: (id: number, data: { name?: string; defaultCategoryId?: number | null; defaultPaymentType?: number | null }) => Promise<boolean>;
  deletePayee: (id: number) => Promise<boolean>;
}

export function usePayees(): UsePayeesResult {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await payeesService.getAll();
      setPayees(data.map(adaptPayee));
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to load payees';
      setError(message);
      throw err; // Propagate for useDataBootstrap
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createPayee = useCallback(async (data: { name: string; defaultCategoryId?: number | null; defaultPaymentType?: number | null }): Promise<number | null> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      const result = await payeesService.create(data);
      await refresh().catch(() => {});
      return result.id;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to create payee';
      setError(message);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const updatePayee = useCallback(async (id: number, data: { name?: string; defaultCategoryId?: number | null; defaultPaymentType?: number | null }): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await payeesService.update(id, data);
      await refresh().catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to update payee';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  const deletePayee = useCallback(async (id: number): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null); // Clear stale errors
      await payeesService.delete(id);
      await refresh().catch(() => {});
      return true;
    } catch (err) {
      const message = err instanceof ApiError
        ? `API Error (${err.status}): ${err.message}`
        : err instanceof Error ? err.message : 'Failed to delete payee';
      setError(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [refresh]);

  return {
    payees,
    isLoading,
    error,
    isSaving,
    refresh,
    createPayee,
    updatePayee,
    deletePayee,
  };
}
