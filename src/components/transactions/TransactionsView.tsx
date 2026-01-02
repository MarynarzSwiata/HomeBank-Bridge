import React, { useState, useMemo, useCallback } from 'react';
import type { Transaction, Account, Category, Payee } from '../../types';
import { TransactionForm, TransactionSaveData, TransactionFormValues } from './TransactionForm';
import { transactionsService } from '../../api/services';
import { ImportModal } from '../shared/ImportModal';
import SearchableSelect from '../shared/SearchableSelect';
import { 
  Button, 
  ActionBar, 
  Card, 
  ConfirmModal, 
  Alert, 
  Spinner 
} from '../common';
import { exportLogService } from '../../api/services';
import { 
  parseDateForComparison, 
  formatDateForDisplay, 
  getTodayISO 
} from '../../utils/dateUtils';

export interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  dateFormat: string;
  decimalSeparator: string;
  isAnonymized: boolean;
  initialAccountFilter?: string; // Account ID to filter by on mount
  onClearAccountFilter?: () => void; // Callback when account filter is cleared
  onSaveTransaction: (data: TransactionSaveData) => Promise<boolean>;
  onDeleteTransaction: (id: number) => Promise<boolean>;
  onRefresh: () => void;
  onExportLogged?: () => Promise<void>;
  onClearError?: () => void;
  onToggleAnonymize?: () => void;
  onCategoryCreate?: (name: string, parentId?: number) => Promise<number | null>;
}

type SortField = 'date' | 'payee' | 'category' | 'amount';
type SortOrder = 'asc' | 'desc';

export function TransactionsView({
  transactions,
  accounts,
  categories,
  payees,
  isLoading,
  isSaving,
  error,
  dateFormat,
  decimalSeparator,
  isAnonymized,
  initialAccountFilter = '',
  onClearAccountFilter,
  onSaveTransaction,
  onDeleteTransaction,
  onRefresh,
  onExportLogged,
  onClearError,
  onToggleAnonymize,
  onCategoryCreate,
}: TransactionsViewProps) {
  // Filter state - use initialAccountFilter if provided
  const [filterAccount, setFilterAccount] = useState(initialAccountFilter);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPayee, setFilterPayee] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterType, setFilterType] = useState('');
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(!!initialAccountFilter);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Sync filterAccount when initialAccountFilter prop changes (e.g., from account view navigation)
  React.useEffect(() => {
    setFilterAccount(initialAccountFilter);
    if (initialAccountFilter) {
      setIsFiltersExpanded(true);
    }
  }, [initialAccountFilter]);

  // Sort state
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Form state
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Pagination
  const [itemsToShow, setItemsToShow] = useState(25);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  const handleImport = async (csvContent: string, accountId?: number, skipDuplicates?: boolean, fmt?: string) => {
      const result = await transactionsService.importCSV(csvContent, accountId, skipDuplicates, fmt || dateFormat);
      if (result.count >= 0) {
          onRefresh();
      }
      return result;
  };

  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    const traverse = (cats: Category[], path = '') => {
      cats.forEach(c => {
        const fullPath = path ? `${path}:${c.name}` : c.name;
        map.set(c.id, fullPath);
        if (c.children) traverse(c.children, fullPath);
      });
    };
    traverse(categories);
    return map;
  }, [categories]);

  // Flatten categories for filter dropdown
  const categoryOptions = useMemo(() => {
    const res: { id: number; name: string }[] = [];
    categoryMap.forEach((name, id) => {
      res.push({ id, name: name.includes(':') ? name.replace(/:/g, '  » ') : name });
    });
    return res;
  }, [categoryMap]);

  const accountOptions = useMemo(() => 
    accounts.map(a => ({ id: a.id, name: a.name })),
    [accounts]
  );

  const typeOptions = [
    { id: 'expense', name: 'Expense' },
    { id: 'income', name: 'Income' },
    { id: 'transfer', name: 'Transfer' },
  ];

  // Sorting helper
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    };
  };

  // Header Cell for sorting
  const SortableHeader = ({ field, label, colSpan }: { field: SortField; label: string; colSpan: string }) => (
    <div 
      className={`${colSpan} flex items-center gap-1 cursor-pointer hover:text-white transition-colors group`}
      onClick={() => handleSort(field)}
    >
      {label}
      <span className={`transition-opacity ${sortField === field ? 'opacity-100 text-indigo-400' : 'opacity-0 group-hover:opacity-50'}`}>
        {sortField === field && sortOrder === 'asc' ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" /></svg>
        ) : (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
        )}
      </span>
    </div>
  );

  // Filtered and sorted transactions
  const filteredAndSortedTransactions = useMemo(() => {
    const filtered = transactions.filter((t) => {
      if (filterAccount && String(t.account_id) !== filterAccount) return false;
      if (filterCategory && String(t.category_id) !== filterCategory) return false;
      if (filterPayee && !t.payee.toLowerCase().includes(filterPayee.toLowerCase())) return false;

      const tCompDate = parseDateForComparison(t.date);
      if (filterDateFrom && tCompDate < filterDateFrom) return false;
      if (filterDateTo && tCompDate > filterDateTo) return false;

      if (filterType) {
        if (filterType === 'expense' && ((t.amount || 0) >= 0 || t.transfer_id)) return false;
        if (filterType === 'income' && ((t.amount || 0) <= 0 || t.transfer_id)) return false;
        if (filterType === 'transfer' && !t.transfer_id) return false;
      }

      return true;
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date':
          comparison = parseDateForComparison(a.date).localeCompare(parseDateForComparison(b.date));
          break;
        case 'payee':
          comparison = (a.payee || '').localeCompare(b.payee || '');
          break;
        case 'category':
          comparison = (a.category_name || '').localeCompare(b.category_name || '');
          break;
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [transactions, filterAccount, filterCategory, filterPayee, filterDateFrom, filterDateTo, filterType, sortField, sortOrder]);

  // Paginated
  const visibleTransactions = useMemo(() => {
    return filteredAndSortedTransactions.slice(0, itemsToShow);
  }, [filteredAndSortedTransactions, itemsToShow]);

  // Clear filters
  const clearFilters = useCallback(() => {
    setFilterAccount('');
    setFilterCategory('');
    setFilterPayee('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterType('');
    setItemsToShow(25);
    // Notify parent to clear account filter state
    onClearAccountFilter?.();
  }, [onClearAccountFilter]);

  // Selection handlers
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllSelection = useCallback(() => {
    if (selectedIds.size === filteredAndSortedTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedTransactions.map(t => t.id)));
    }
  }, [selectedIds.size, filteredAndSortedTransactions]);

  // Edit handler
  const startEditing = useCallback((t: Transaction) => {
    setEditingTransaction(t);
    setIsFormExpanded(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Bulk Delete
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    let successCount = 0;
    const ids = Array.from(selectedIds) as number[];
    
    for (const id of ids) {
      const success = await onDeleteTransaction(id);
      if (success) successCount++;
    }
    
    setSelectedIds(new Set());
    setDeleteConfirm(null);
    setIsBulkDeleting(false);
    onRefresh();
  }, [selectedIds, onDeleteTransaction, onRefresh]);

  const requestBulkDelete = useCallback(() => {
    setDeleteConfirm({
      id: -1, // Special ID for bulk
      name: `${selectedIds.size} selected records`,
    });
  }, [selectedIds.size]);

  // Build initial form values for editing
  const getEditFormValues = useCallback((t: Transaction): Partial<TransactionFormValues> => {
    let entryType: 'expense' | 'income' | 'transfer' = (t.amount || 0) < 0 ? 'expense' : 'income';
    let targetAccId = '';
    let targetAmountVal = '';
    const isoDate = t.date.includes('-') && t.date.split('-')[0].length === 4 ? t.date : getTodayISO();

    if (t.transfer_id) {
      entryType = 'transfer';
      const otherPart = transactions.find(ot => ot.transfer_id === t.transfer_id && ot.id !== t.id);
      
      // We always want to edit from the perspective of the expense (-) part
      // so that accountId = source and targetAccountId = destination
      if (otherPart) {
        if (t.amount < 0) {
          // Current is expense
          targetAccId = String(otherPart.account_id);
          targetAmountVal = String(Math.abs(otherPart.amount || 0)).replace('.', ',');
        } else {
          // Current is income, flip to other part
          const expensePart = otherPart;
          const incomePart = t;
          return {
            entryType: 'transfer',
            payee: expensePart.payee,
            amount: String(Math.abs(expensePart.amount || 0)).replace('.', ','),
            accountId: String(expensePart.account_id),
            targetAccountId: String(incomePart.account_id),
            targetAmount: String(Math.abs(incomePart.amount || 0)).replace('.', ','),
            categoryId: String(expensePart.category_id || ''),
            paymentType: String(expensePart.payment_type),
            date: isoDate,
            memo: expensePart.memo || '',
            editingId: expensePart.id,
          };
        }
      }
    }

    return {
      entryType,
      payee: t.payee,
      amount: String(Math.abs(t.amount || 0)).replace('.', ','),
      accountId: String(t.account_id),
      targetAccountId: targetAccId,
      targetAmount: targetAmountVal,
      categoryId: String(t.category_id || ''),
      paymentType: String(t.payment_type),
      date: isoDate,
      memo: t.memo || '',
      editingId: t.id,
    };
  }, [transactions]);

  // Cancel form
  const handleCancel = useCallback(() => {
    setIsFormExpanded(false);
    setEditingTransaction(null);
  }, []);

  // Save handler
  const handleSave = useCallback(async (data: TransactionSaveData): Promise<boolean> => {
    const success = await onSaveTransaction(data);
    if (success) {
      handleCancel();
    }
    return success;
  }, [onSaveTransaction, handleCancel]);

  // Delete handlers
  const requestDelete = useCallback((t: Transaction) => {
    setDeleteConfirm({
      id: t.id,
      name: t.transfer_id ? `Transfer (${Math.abs(t.amount).toFixed(2)})` : `${t.payee || 'Transaction'} (${t.amount.toFixed(2)})`,
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    
    if (deleteConfirm.id === -1) {
      await handleBulkDelete();
    } else {
      const success = await onDeleteTransaction(deleteConfirm.id);
      if (success) {
        onRefresh();
      }
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, onDeleteTransaction, handleBulkDelete, onRefresh]);

  const cancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // Check if filters are active
  const hasActiveFilters = filterAccount || filterCategory || filterPayee || filterDateFrom || filterDateTo || filterType;

  return (
    <div className="space-y-8">
      {/* Error Display */}
      {error && (
        <Alert 
          variant="error" 
          message={error} 
          onClear={onClearError} 
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Transaction?"
        message={
          <>
            Are you sure you want to delete <span className="text-white font-bold">{deleteConfirm?.name}</span>? 
            This action cannot be undone.
          </>
        }
        confirmLabel={deleteConfirm?.id === -1 ? `Purge ${selectedIds.size} Records` : "Delete"}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSaving || isBulkDeleting}
        variant="danger"
      />

      {/* Actions & Form Section */}
      <div className="space-y-4">
        <ActionBar
          title={editingTransaction ? 'Edit Transaction' : isFormExpanded ? 'New Transaction' : 'Ledger Actions'}
          subtitle={editingTransaction ? 'Modifying existing entry' : 'Manage your money movement'}
          isExpanded={isFormExpanded || !!editingTransaction}
          onToggle={() => {
            if (editingTransaction) handleCancel();
            else setIsFormExpanded(!isFormExpanded);
          }}
          expandLabel="Add Transaction"
          collapseLabel={editingTransaction ? "Cancel Edit" : "Close"}
          actions={
            <div className="flex flex-wrap gap-2">
              {selectedIds.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const selectedItems = transactions.filter(t => selectedIds.has(t.id));
                      
                      // Smart Grouping based on selection
                      const uniqueAccounts = new Set(selectedItems.map(t => t.account_id));
                      const shouldGroup = uniqueAccounts.size > 1;

                      const exportFilters: any = {
                        ids: Array.from(selectedIds),
                        grouped: shouldGroup,
                        dateFormat,
                        decimalSeparator
                      };

                      // Suggest filename for single-account selection
                      if (!shouldGroup && uniqueAccounts.size === 1) {
                          const accId = Array.from(uniqueAccounts)[0];
                          const acc = accounts.find(a => a.id === accId);
                          if (acc) {
                              const dateStr = new Date().toISOString().split('T')[0];
                              const safeName = acc.name.replace(/[/\\?%*:|"<>]/g, '-');
                              exportFilters.filename = `${safeName}-${dateStr}.csv`;
                          }
                      }

                      const result = await transactionsService.exportCSV(exportFilters);
                      
                      if (shouldGroup && result) {
                        const groups = result as Record<number, { name: string; csv: string; count: number }>;
                        const dateStr = new Date().toISOString().split('T')[0];
                        
                        for (const [, data] of Object.entries(groups)) {
                            const safeName = data.name.replace(/[/\\?%*:|"<>]/g, '-');
                            const filename = `${safeName}-${dateStr}.csv`;
                            
                            const blob = new Blob([data.csv], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            window.URL.revokeObjectURL(url);
                            document.body.removeChild(a);

                            // Create log entry for each
                            await exportLogService.createLog({
                                filename,
                                count: data.count,
                                csv_content: data.csv
                            }).catch(err => console.error('Failed to log grouped export', err));
                        }
                      }
                      
                      if (onExportLogged) await onExportLogged();
                    } catch (err) {
                      console.error('Export failed', err);
                    }
                  }}
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                >
                  Export ({selectedIds.size})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsImportOpen(true)}
                icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>}
              >
                Import
              </Button>
            </div>
          }
          className={editingTransaction ? 'border-amber-500/50 bg-amber-950/10' : ''}
        />

        {(isFormExpanded || editingTransaction) && (
          <div className="animate-in slide-in-from-top-4 duration-500">
            <TransactionForm
              key={editingTransaction?.id || 'new'}
              mode={editingTransaction ? 'edit' : 'create'}
              initialValues={editingTransaction ? getEditFormValues(editingTransaction) : undefined}
              accounts={accounts}
              categories={categories}
              payees={payees}
              transactions={transactions}
              isSaving={isSaving}
              onSave={handleSave}
              onCancel={handleCancel}
              onCategoryCreate={onCategoryCreate}
            />
          </div>
        )}
      </div>

      {/* Filters (Collapsible) */}
      <div className="space-y-4">
        <div 
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="flex items-center justify-between px-8 py-5 bg-slate-900/50 border border-slate-800 rounded-3xl cursor-pointer hover:bg-slate-800/50 transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-xl bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 transition-all ${isFiltersExpanded ? 'bg-indigo-500 text-white' : ''}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">Refine Ledger</h3>
              <p className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">Filter by account, category, date or entity</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {hasActiveFilters && (
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/30">Active Filters</span>
            )}
            <svg className={`w-5 h-5 text-slate-600 transition-transform ${isFiltersExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>

        {isFiltersExpanded && (
          <div className="p-8 bg-slate-900/50 border border-slate-800 rounded-3xl grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-4 duration-500">
            <SearchableSelect
              label="Vault / Account"
              options={accountOptions}
              value={filterAccount}
              onChange={(val) => {
                setFilterAccount(val);
                // If clearing the filter, notify parent to sync state
                if (!val) {
                  onClearAccountFilter?.();
                }
              }}
              placeholder="All Accounts"
              showAllOption
              allLabel="ALL VAULTS"
            />
            <SearchableSelect
              label="Category"
              options={categoryOptions}
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="All Categories"
              showAllOption
              allLabel="ALL CATEGORIES"
              onAddNew={async (name) => {
                const newId = await onCategoryCreate?.(name);
                if (newId) setFilterCategory(String(newId));
              }}
            />
            <SearchableSelect
              label="Flow Type"
              options={typeOptions}
              value={filterType}
              onChange={setFilterType}
              placeholder="All Types"
              showAllOption
              allLabel="ALL TYPES"
            />
            <div className="relative">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-2">Entity Name</label>
              <input
                type="text"
                placeholder="Search entity..."
                value={filterPayee}
                onChange={(e) => setFilterPayee(e.target.value)}
                className="w-full h-[60px] bg-slate-950/50 border border-slate-800 rounded-2xl px-6 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white placeholder:text-slate-700"
              />
            </div>
            <div className="relative group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-2">From Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full h-[60px] bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 group-hover:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" strokeWidth="2.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M8 2v4M16 2v4" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="relative group">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-2">To Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full h-[60px] bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-white cursor-pointer"
                  onClick={(e) => e.currentTarget.showPicker?.()}
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 group-hover:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" strokeWidth="2.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M8 2v4M16 2v4" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex items-end gap-3 lg:col-span-2">
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="w-full h-[60px] text-xs"
                disabled={!hasActiveFilters}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center px-4 gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-[10px] font-black uppercase tracking-widest text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
            Total entries: <span className="text-slate-400">{filteredAndSortedTransactions.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
            Viewing: <span className="text-slate-400">{visibleTransactions.length}</span>
          </div>
          <button
            onClick={onToggleAnonymize}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
              isAnonymized 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
            title={isAnonymized ? "Show values" : "Hide values"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAnonymized ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </>
              )}
            </svg>
            <span className="font-black">{isAnonymized ? 'HIDDEN' : 'VISIBLE'}</span>
          </button>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 text-indigo-400">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></div>
              Selected: <span className="font-black">{selectedIds.size}</span>
            </div>
          )}
          <button
            onClick={toggleAllSelection}
            className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="font-black text-[10px] uppercase tracking-widest">
              {selectedIds.size === filteredAndSortedTransactions.length ? 'Deselect All' : 'Select All'}
            </span>
          </button>
        </div>

        {selectedIds.size > 0 && (
          <Button
            variant="danger"
            size="sm"
            onClick={requestBulkDelete}
            className="h-10 px-6 rounded-xl animate-in fade-in zoom-in-95 duration-300 w-full md:w-auto"
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
          >
            Delete Mass
          </Button>
        )}
      </div>

      {/* Transactions List */}
      <div className="space-y-3">
        {/* Header (Desktop) */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30 rounded-3xl border border-slate-800/50">
          <div className="col-span-1 flex items-center justify-center">
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === filteredAndSortedTransactions.length}
              onChange={toggleAllSelection}
              className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900 transition-all cursor-pointer"
            />
          </div>
          <SortableHeader field="date" label="Date" colSpan="col-span-2" />
          <SortableHeader field="payee" label="Entity / Payee" colSpan="col-span-3" />
          <SortableHeader field="category" label="Category" colSpan="col-span-2" />
          <SortableHeader field="amount" label="Amount" colSpan="col-span-2 text-right justify-end" />
          <div className="col-span-2 text-right uppercase tracking-[0.2em] font-black py-1">Actions</div>
        </div>

        {/* Rows */}
        <div className="space-y-3">
          {visibleTransactions.map((t) => {
            const isSelected = selectedIds.has(t.id);
            const isExpense = (t.amount || 0) < 0;
            const isIncome = (t.amount || 0) > 0;
            const isTransfer = !!t.transfer_id;

            return (
              <div 
                key={t.id} 
                className={`group relative rounded-[2.5rem] bg-slate-900/40 border transition-all ${
                  isSelected ? 'border-indigo-500 bg-indigo-500/5 ring-1 ring-indigo-500/20' : 'border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40'
                }`}
              >
                {/* Desktop Layout */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-6 items-center">
                  <div className="col-span-1 flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(t.id)}
                      className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900 transition-all cursor-pointer"
                    />
                  </div>

                  {/* Date */}
                  <div className="col-span-2">
                    <div className="text-sm font-black text-slate-100 uppercase tracking-tighter">
                      {formatDateForDisplay(t.date, dateFormat)}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-600 mt-1">Manifest Logged</div>
                  </div>

                  {/* Payee */}
                  <div className="col-span-3 truncate">
                    <div className="text-sm font-black text-slate-100 uppercase tracking-tight truncate">
                      {t.payee || 'Anonymous Entity'}
                    </div>
                    {t.memo && (
                      <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600 mt-1 truncate max-w-full italic">
                        "{t.memo}"
                      </div>
                    )}
                  </div>

                  {/* Category & Account */}
                  <div className="col-span-2 truncate">
                    <div className="text-[11px] font-black text-slate-200 truncate uppercase tracking-tight">
                      {t.category_id ? categoryMap.get(t.category_id)?.replace(/:/g, ' : ') : 'Unassigned'}
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.1em] text-slate-600 mt-1 flex items-center gap-1.5">
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      {t.account_name}
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="col-span-2 text-right">
                    <div className={`text-base font-black tracking-tighter ${
                      isExpense ? 'text-rose-400' : isIncome ? 'text-emerald-400' : 'text-indigo-400'
                    }`}>
                      {isAnonymized ? 'xxxx' : (
                        isExpense
                          ? `-${Math.abs(t.amount || 0).toFixed(2)}`
                          : `+${(t.amount || 0).toFixed(2)}`
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => startEditing(t)}
                      className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-600/20 transition-all"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={() => requestDelete(t)}
                      className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:bg-rose-600 hover:text-white hover:shadow-lg hover:shadow-rose-600/20 transition-all"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>

                {/* Mobile Card Layout */}
                <div className="md:hidden p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(t.id)}
                        className="w-6 h-6 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 focus:ring-offset-slate-900 transition-all cursor-pointer"
                      />
                      <div className="text-xs font-black text-indigo-400 uppercase tracking-tighter">
                        {formatDateForDisplay(t.date, dateFormat)}
                      </div>
                    </div>
                    <div className={`text-lg font-black tracking-tighter ${
                      isExpense ? 'text-rose-400' : isIncome ? 'text-emerald-400' : 'text-indigo-400'
                    }`}>
                      {isAnonymized ? 'xxxx' : (
                        isExpense
                          ? `-${Math.abs(t.amount || 0).toFixed(2)}`
                          : `+${(t.amount || 0).toFixed(2)}`
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-base font-black text-slate-100 uppercase tracking-tight truncate">
                      {t.payee || 'Anonymous Entity'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                       <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-800/50 px-2 py-0.5 rounded-md">
                         {t.category_id ? categoryMap.get(t.category_id)?.split(':').pop() : 'Unassigned'}
                       </span>
                       <span className="text-[10px] font-bold text-indigo-400/70 uppercase flex items-center gap-1">
                         <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                         {t.account_name}
                       </span>
                    </div>
                    {t.memo && (
                      <div className="text-[10px] font-medium text-slate-500 italic mt-1 line-clamp-1">
                        "{t.memo}"
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => startEditing(t)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-slate-200 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      Edit
                    </button>
                    <button
                      onClick={() => requestDelete(t)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 text-slate-200 font-black text-[10px] uppercase tracking-widest hover:bg-rose-600 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {visibleTransactions.length === 0 && !isLoading && (
          <div className="text-center py-20 bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-[3rem]">
            <div className="w-20 h-20 bg-slate-800/50 text-slate-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <p className="text-xl font-black text-slate-400 uppercase tracking-tight">Zero matching entries</p>
            <p className="text-sm text-slate-600 mt-2">Adjust filters or create a new ledger record</p>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-8">Reset Constraints</Button>
            )}
          </div>
        )}

        {/* Load More */}
        {itemsToShow < filteredAndSortedTransactions.length && (
          <div className="pt-6">
            <Button
              variant="ghost"
              size="lg"
              onClick={() => setItemsToShow(prev => prev + 25)}
              className="w-full h-20 rounded-[2rem] border-2 border-dashed border-slate-800 hover:border-indigo-500/50 hover:bg-indigo-500/5"
            >
              Expose More Data ({filteredAndSortedTransactions.length - itemsToShow} remaining)
            </Button>
          </div>
        )}
      </div>

      <ImportModal 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        type="transactions"
        onImport={handleImport}
        accounts={accounts}
        dateFormat={dateFormat}
      />
    </div>
  );
}
