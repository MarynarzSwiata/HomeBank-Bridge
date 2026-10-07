import { useCallback, useState } from 'react';
import { scheduledService, ApiError } from '../api';
import type { ScheduledInput, ScheduledItem } from '../types';
import { toISO } from '../utils/periodUtils';

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? `API Error (${err.status}): ${err.message}` : err instanceof Error ? err.message : fallback;

/**
 * Scheduled (recurring) transactions. `onPosted` runs after anything that creates
 * real transactions, so balances and the ledger can refresh.
 */
export function useScheduled(onPosted: () => Promise<void> | void) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setItems(await scheduledService.getAll());
    } catch (err) {
      setError(errorText(err, 'Failed to load scheduled transactions'));
    }
  }, []);

  // Runs an action, refreshes the list; returns the action result or null on failure
  const run = useCallback(async <T,>(action: () => Promise<T>, fallback: string, postsTransactions = false): Promise<T | null> => {
    try {
      setIsSaving(true);
      setError(null);
      const result = await action();
      await refresh();
      if (postsTransactions) await onPosted();
      return result;
    } catch (err) {
      setError(errorText(err, fallback));
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [refresh, onPosted]);

  return {
    items,
    isSaving,
    error,
    refresh,
    save: (data: ScheduledInput, id?: number) =>
      run(() => (id ? scheduledService.update(id, data) : scheduledService.create(data)), 'Failed to save'),
    remove: (id: number) => run(() => scheduledService.delete(id), 'Failed to delete'),
    post: (id: number) => run(() => scheduledService.post(id), 'Failed to post', true),
    skip: (id: number) => run(() => scheduledService.skip(id), 'Failed to skip'),
    postDue: () => run(() => scheduledService.postDue(toISO(new Date())), 'Failed to post due transactions', true),
  };
}

export type UseScheduledResult = ReturnType<typeof useScheduled>;
