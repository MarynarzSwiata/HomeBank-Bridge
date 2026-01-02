/**
 * TransactionsTab - Minimal Working Integration Example
 * 
 * This is a self-contained tab component that demonstrates how to use
 * the new hooks and TransactionsView. Can be directly dropped into App.tsx.
 * 
 * NOTE: This is NOT yet integrated into App.tsx. Full integration requires
 * replacing the existing transactions tab content in App.tsx with this component.
 */

import React, { useCallback, useState } from 'react';
import { useDataBootstrap } from '../../hooks';
import { TransactionsView } from './TransactionsView';
import type { TransactionSaveData } from './TransactionForm';

interface TransactionsTabProps {
  dateFormat: string;
  isAnonymized: boolean;
}

export function TransactionsTab({ dateFormat, isAnonymized }: TransactionsTabProps) {
  // Use the bootstrap hook for all data
  const {
    isBootstrapping,
    bootstrapError,
    refreshAll,
    accounts,
    categories,
    payees,
    transactions,
  } = useDataBootstrap();

  // Local error state for clearing
  const [localError, setLocalError] = useState<string | null>(null);

  // Combine errors
  const displayError = localError || transactions.error || bootstrapError;

  // Clear error handler
  const clearError = useCallback(() => {
    setLocalError(null);
  }, []);

  // Handle save transaction
  const handleSaveTransaction = useCallback(async (data: TransactionSaveData): Promise<boolean> => {
    setLocalError(null);

    if (data.editingId) {
      // UPDATE - data.amount is already signed from form
      const success = await transactions.updateTransaction(data.editingId, {
        accountId: data.accountId,
        amount: data.amount,
        date: data.date,
        payee: data.payee,
        memo: data.memo,
        categoryId: data.categoryId,
        paymentType: data.paymentType,
      });
      
      if (success) {
        // Refresh accounts too (balance changed)
        await accounts.refresh().catch(() => {});
      }
      return success;
    } else {
      // CREATE or TRANSFER - data.amount is unsigned
      const result = await transactions.createTransaction({
        type: data.type,
        accountId: data.accountId,
        amount: data.amount,
        date: data.date,
        payee: data.payee,
        memo: data.memo,
        categoryId: data.categoryId,
        paymentType: data.paymentType,
        targetAccountId: data.targetAccountId,
      });

      if (result) {
        await accounts.refresh().catch(() => {});
      }
      return result !== null;
    }
  }, [transactions, accounts]);

  // Handle delete transaction
  const handleDeleteTransaction = useCallback(async (id: number): Promise<boolean> => {
    setLocalError(null);
    const success = await transactions.deleteTransaction(id);
    if (success) {
      await accounts.refresh().catch(() => {});
    }
    return success;
  }, [transactions, accounts]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    transactions.refresh();
  }, [transactions]);

  // Bootstrap loading state
  if (isBootstrapping) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-bold">Loading data...</p>
      </div>
    );
  }

  // Bootstrap error state with retry
  if (bootstrapError && transactions.transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-red-400 text-sm font-bold text-center max-w-md">{bootstrapError}</p>
        <button
          onClick={refreshAll}
          className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <TransactionsView
      transactions={transactions.transactions}
      accounts={accounts.accounts}
      categories={categories.categories}
      payees={payees.payees}
      isLoading={transactions.isLoading}
      isSaving={transactions.isSaving}
      error={displayError}
      dateFormat={dateFormat}
      isAnonymized={isAnonymized}
      onSaveTransaction={handleSaveTransaction}
      onDeleteTransaction={handleDeleteTransaction}
      onRefresh={handleRefresh}
      onClearError={clearError}
    />
  );
}

/**
 * Integration into App.tsx:
 * 
 * 1. Add import: 
 *    import { TransactionsTab } from './src/components/transactions/TransactionsTab.example';
 * 
 * 2. Replace the transactions tab content:
 *    {activeTab === "transactions" && (
 *      <TransactionsTab 
 *        dateFormat={dateFormat} 
 *        isAnonymized={isAnonymized} 
 *      />
 *    )}
 * 
 * 3. Remove old transaction state/handlers from App.tsx (after testing):
 *    - entryType, editingId, payee, amount, accountId, targetAccountId...
 *    - filterAccount, filterCategory, filterPayment, filterPayee...
 *    - selectedTransIds, itemsToShow...
 *    - saveEntry, startEditing, toggleSelection, resetForm...
 */
