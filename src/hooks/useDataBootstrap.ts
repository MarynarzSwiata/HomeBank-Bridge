import { useEffect, useState, useCallback } from 'react';
import { useAccounts } from './useAccounts';
import { useCategories } from './useCategories';
import { usePayees } from './usePayees';
import { useTransactions } from './useTransactions';
import { useExportLog } from './useExportLog';

/**
 * Orchestrator hook that initializes all data hooks and triggers parallel refresh on mount.
 * Exposes individual hook results and a combined loading/error state for initial bootstrap.
 */
export function useDataBootstrap(isAuthenticated: boolean) {
  const accountsHook = useAccounts();
  const categoriesHook = useCategories();
  const payeesHook = usePayees();
  const transactionsHook = useTransactions();
  const exportLogHook = useExportLog();

  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!isAuthenticated) return;
    
    setIsBootstrapping(true);
    setBootstrapError(null);
    
    // Use Promise.allSettled to capture all results, then check for failures
    const results = await Promise.allSettled([
      accountsHook.refresh(),
      categoriesHook.refresh(),
      payeesHook.refresh(),
      transactionsHook.refresh(),
      exportLogHook.refresh(),
    ]);
    
    // Check if any refresh failed
    const failedResults = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failedResults.length > 0) {
      const firstError = failedResults[0].reason;
      const message = firstError instanceof Error ? firstError.message : 'Failed to load data';
      setBootstrapError(message);
    }
    
    setIsBootstrapping(false);
  }, [
    isAuthenticated,
    accountsHook.refresh,
    categoriesHook.refresh,
    payeesHook.refresh,
    transactionsHook.refresh,
    exportLogHook.refresh,
  ]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshAll();
    }
  }, [isAuthenticated, refreshAll]);

  // Aggregate errors from individual hooks (excluding bootstrap error itself)
  const runtimeErrors = {
    accounts: accountsHook.error,
    categories: categoriesHook.error,
    payees: payeesHook.error,
    transactions: transactionsHook.error,
    exportLog: exportLogHook.error,
  };

  return {
    // Bootstrap state
    isBootstrapping,
    bootstrapError, // Only reflects failures during refreshAll()
    refreshAll,

    // Combined runtime error status
    runtimeError: accountsHook.error || categoriesHook.error || payeesHook.error || transactionsHook.error || exportLogHook.error,
    runtimeErrors,

    // Individual hooks for fine-grained control
    accounts: accountsHook,
    categories: categoriesHook,
    payees: payeesHook,
    transactions: transactionsHook,
    exportLog: exportLogHook,
  };
}
