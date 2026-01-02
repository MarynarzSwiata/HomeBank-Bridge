import React, { useState, useCallback, useMemo } from 'react';
import type { Account, Category, Payee, Transaction } from '../../types';
import type { TransactionType } from '../../hooks';
import { 
  Button, 
  Alert 
} from '../common';
import SearchableSelect from '../shared/SearchableSelect';

// --- Types ---
export interface TransactionFormProps {
  mode: 'create' | 'edit';
  initialValues?: Partial<TransactionFormValues>;
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  transactions: Transaction[]; // For finding transfer pairs
  isSaving: boolean;
  onSave: (data: TransactionSaveData) => Promise<boolean>;
  onCancel: () => void;
  onCategoryCreate?: (name: string, parentId?: number) => Promise<number | null>;
  key?: React.Key;
}

export interface TransactionFormValues {
  entryType: TransactionType;
  payee: string;
  amount: string;
  accountId: string;
  targetAccountId: string;
  categoryId: string;
  paymentType: string;
  date: string;
  memo: string;
  editingId: number | null;
  targetAmount?: string;
}

export interface TransactionSaveData {
  type: TransactionType;
  accountId: number;
  amount: number;
  date: string;
  payee?: string;
  memo?: string;
  categoryId?: number;
  paymentType?: number;
  targetAccountId?: number;
  targetAmount?: number;
  editingId?: number | null;
}

// --- Constants ---
const TRANSACTION_TYPES: { id: TransactionType; name: string }[] = [
  { id: 'expense', name: 'Expense' },
  { id: 'income', name: 'Income' },
  { id: 'transfer', name: 'Transfer' },
];

const PAYMENT_LEXICON: Record<number, { name: string; icon: string }> = {
  0: { name: 'None', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
  1: { name: 'Credit Card', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  2: { name: 'Check', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  3: { name: 'Cash', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
  4: { name: 'Bank Transfer', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  6: { name: 'Debit Card', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
  7: { name: 'Standing Order', icon: 'M4 4v5h.582m15356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  8: { name: 'Electronic Payment', icon: 'M21 12a9 9 0 11-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9' },
  9: { name: 'Deposit', icon: 'M19 14l-7 7m0 0l-7-7m7 7V3' },
  10: { name: 'Fee', icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z' },
  11: { name: 'Direct Debit', icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' },
};

const PAYMENT_OPTIONS = Object.entries(PAYMENT_LEXICON).map(([id, val]) => ({
  id: parseInt(id),
  name: val.name,
  icon: val.icon,
}));

// --- Helpers ---
const getTodayISO = () => new Date().toISOString().split('T')[0];

const sanitizeAmountInput = (input: string): string => {
  return input.replace(/[^0-9,.-]/g, '');
};

// --- Component ---
export function TransactionForm({
  mode,
  initialValues,
  accounts,
  categories,
  payees,
  transactions,
  isSaving,
  onSave,
  onCancel,
  onCategoryCreate,
}: TransactionFormProps) {
  // Form state
  const [entryType, setEntryType] = useState<TransactionType>(initialValues?.entryType || 'expense');
  const [payee, setPayee] = useState(initialValues?.payee || '');
  const [amount, setAmount] = useState(initialValues?.amount || '');
  const [accountId, setAccountId] = useState(initialValues?.accountId || '');
  const [targetAccountId, setTargetAccountId] = useState(initialValues?.targetAccountId || '');
  const [paymentType, setPaymentType] = useState(initialValues?.paymentType || '6');
  const [date, setDate] = useState(initialValues?.date || getTodayISO());
  const [memo, setMemo] = useState(initialValues?.memo || '');
  const [targetAmount, setTargetAmount] = useState(initialValues?.targetAmount || '');
  const [editingId] = useState<number | null>(initialValues?.editingId || null);
  const [isSmartApplied, setIsSmartApplied] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const flatCategories = useMemo(() => {
    const list: Category[] = [];
    const traverse = (cats: Category[]) => {
      cats.forEach(c => {
        list.push(c);
        if (c.children) traverse(c.children);
      });
    };
    traverse(categories);
    return list;
  }, [categories]);

  // Split category state
  const [mainCategoryId, setMainCategoryId] = useState<string>(() => {
    if (!initialValues?.categoryId) return '';
    const cat = flatCategories.find(c => String(c.id) === initialValues.categoryId);
    if (!cat) return '';
    return cat.parent_id ? String(cat.parent_id) : String(cat.id);
  });

  const [subCategoryId, setSubCategoryId] = useState<string>(() => {
    if (!initialValues?.categoryId) return '';
    const cat = flatCategories.find(c => String(c.id) === initialValues.categoryId);
    if (!cat || !cat.parent_id) return '';
    return String(cat.id);
  });

  // Main category options
  const mainCategoryOptions = useMemo(() => 
    categories.map(c => ({ id: c.id, name: c.name })),
    [categories]
  );

  // Subcategory options based on main selection
  const subCategoryOptions = useMemo(() => {
    if (!mainCategoryId) return [];
    const main = categories.find(c => String(c.id) === mainCategoryId);
    if (!main || !main.children) return [];
    return main.children.map(c => ({ id: c.id, name: c.name }));
  }, [categories, mainCategoryId]);

  // Account options
  const accountOptions = useMemo(() => 
    accounts.map(a => ({ id: a.id, name: `${a.name} (${a.currency})` })),
    [accounts]
  );

  // Payee suggestions
  const payeeOptions = useMemo(() =>
    payees.map(p => ({ id: p.name, name: p.name })),
    [payees]
  );

  // Smart payee matching
  const handlePayeeChange = useCallback((val: string) => {
    setPayee(val);
    setValidationError(null);
    
    if (entryType === 'transfer' || val.length < 2 || editingId !== null) {
      setIsSmartApplied(false);
      return;
    }
    
    const matchingPayee = payees.find(p => p.name.toLowerCase() === val.toLowerCase());
    if (matchingPayee && matchingPayee.default_category_id) {
      const catId = matchingPayee.default_category_id;
      const cat = flatCategories.find(c => c.id === catId);
      
      if (cat) {
        if (cat.parent_id) {
          setMainCategoryId(String(cat.parent_id));
          setSubCategoryId(String(cat.id));
        } else {
          setMainCategoryId(String(cat.id));
          setSubCategoryId('');
        }
      }
      
      if (matchingPayee.default_payment_type !== null) {
        setPaymentType(String(matchingPayee.default_payment_type));
      }
      setIsSmartApplied(true);
    } else {
      setIsSmartApplied(false);
    }
  }, [entryType, editingId, payees, flatCategories]);

  // Swap accounts for transfer
  const swapAccounts = useCallback(() => {
    const temp = accountId;
    setAccountId(targetAccountId);
    setTargetAccountId(temp);
  }, [accountId, targetAccountId]);

  // Validate form
  const validate = useCallback((): boolean => {
    if (!amount.trim()) {
      setValidationError('Amount is required');
      return false;
    }
    
    const numAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError('Please enter a valid positive amount');
      return false;
    }
    
    if (!accountId) {
      setValidationError('Please select an account');
      return false;
    }
    
    if (entryType === 'transfer') {
      if (!targetAccountId) {
        setValidationError('Please select a target account for transfer');
        return false;
      }
      if (accountId === targetAccountId) {
        setValidationError('Source and target accounts must be different');
        return false;
      }
      // Validate target amount if provided (for currency mismatch)
      if (targetAmount) {
        const numTarget = parseFloat(targetAmount.replace(',', '.'));
        if (isNaN(numTarget) || numTarget <= 0) {
          setValidationError('Please enter a valid positive target amount');
          return false;
        }
      }
    }
    
    setValidationError(null);
    return true;
  }, [amount, accountId, targetAccountId, entryType, targetAmount]);

  // Get selected currency for display
  const selectedCurrency = useMemo(() => {
    const acc = accounts.find(a => String(a.id) === accountId);
    return acc?.currency || '';
  }, [accounts, accountId]);

  // Derive target currency and mismatch
  const targetCurrency = useMemo(() => {
    if (entryType !== 'transfer' || !targetAccountId) return '';
    const acc = accounts.find(a => String(a.id) === targetAccountId);
    return acc?.currency || '';
  }, [entryType, targetAccountId, accounts]);

  const isCurrencyMismatch = selectedCurrency && targetCurrency && selectedCurrency !== targetCurrency;

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validate()) return;
    
    const numAmount = Math.abs(parseFloat(amount.replace(',', '.')));
    
    // Build save data based on mode and type
    const finalCategoryId = subCategoryId ? parseInt(subCategoryId) : (mainCategoryId ? parseInt(mainCategoryId) : null);
    let saveData: TransactionSaveData;

    if (entryType === 'transfer') {
      saveData = {
        type: 'transfer',
        accountId: parseInt(accountId),
        targetAccountId: parseInt(targetAccountId),
        amount: numAmount, // unsigned for transfer
        targetAmount: targetAmount && isCurrencyMismatch ? Math.abs(parseFloat(targetAmount.replace(',', '.'))) : undefined,
        date,
        memo: memo || undefined,
        editingId,
      };
    } else if (editingId) {
      // UPDATE - signed amount
      const finalAmount = entryType === 'expense' ? -numAmount : numAmount;
      saveData = {
        type: entryType,
        accountId: parseInt(accountId),
        amount: finalAmount,
        date,
        payee: payee || undefined,
        memo: memo || undefined,
        categoryId: finalCategoryId || undefined,
        paymentType: paymentType ? parseInt(paymentType) : undefined,
        editingId,
      };
    } else {
      // CREATE - unsigned amount + type
      saveData = {
        type: entryType,
        accountId: parseInt(accountId),
        amount: numAmount,
        date,
        payee: payee || undefined,
        memo: memo || undefined,
        categoryId: finalCategoryId || undefined,
        paymentType: paymentType ? parseInt(paymentType) : undefined,
      };
    }
    
    const success = await onSave(saveData);
    if (success) {
      // Form will be reset by parent via onCancel or re-render
    }
  }, [validate, amount, entryType, accountId, targetAccountId, date, memo, payee, mainCategoryId, subCategoryId, paymentType, editingId, onSave, targetAmount, isCurrencyMismatch]);

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 space-y-6">
      {/* Type Selector */}
      <div className="flex gap-2">
        {TRANSACTION_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setEntryType(t.id)}
            disabled={isSaving}
            className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${
              entryType === t.id
                ? t.id === 'expense'
                  ? 'bg-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.3)]'
                  : t.id === 'income'
                  ? 'bg-emerald-600 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                  : 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {t.name}
          </button>
        ))}
      </div>

      {/* Validation Error */}
      {validationError && (
        <Alert variant="error" message={validationError} onClose={() => setValidationError(null)} />
      )}

      {/* Smart Match Indicator */}
      {isSmartApplied && (
        <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 rounded-2xl px-5 py-3 border border-indigo-500/20 animate-in fade-in slide-in-from-top-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Lexicon pattern matched
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Amount */}
        <div className="relative">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">
            Amount {selectedCurrency && `(${selectedCurrency})`}
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            placeholder="0,00"
            disabled={isSaving}
            className="w-full h-[60px] bg-slate-950/50 border border-slate-800 rounded-2xl px-6 text-xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-white placeholder:text-slate-700"
          />
        </div>

        {/* Date */}
        <div className="relative group">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">
            Operation Date
          </label>
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
              disabled={isSaving}
              className="w-full h-[60px] bg-slate-950/50 border border-slate-800 rounded-2xl px-6 py-5 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-white cursor-pointer"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 group-hover:text-indigo-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2" strokeWidth="2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M8 2v4M16 2v4" />
              </svg>
            </div>
          </div>
        </div>

        {/* Account */}
        <SearchableSelect
          label={entryType === 'transfer' ? 'Source Vault' : 'Target Vault'}
          options={accountOptions}
          value={accountId}
          onChange={setAccountId}
          placeholder="Select account..."
          className="w-full"
          disabled={!!editingId && entryType === 'transfer'}
        />

        {/* Target Account (Transfer only) */}
        {entryType === 'transfer' && (
          <div className="relative">
            <div className="flex justify-between items-center mb-1.5 px-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Destination Vault
              </label>
              <button
                type="button"
                onClick={swapAccounts}
                disabled={isSaving}
                className="text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Swap
              </button>
            </div>
            <SearchableSelect
              options={accountOptions.filter(a => String(a.id) !== accountId)}
              value={targetAccountId}
              onChange={setTargetAccountId}
              placeholder="Select destination..."
              disabled={!!editingId && entryType === 'transfer'}
            />
          </div>
        )}

        {/* Target Amount (Transfer & Currency Mismatch only) */}
        {entryType === 'transfer' && isCurrencyMismatch && (
          <div className="animate-in zoom-in-95 duration-300">
            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2 px-2">
              Exchange Amount ({targetCurrency})
            </label>
            <input
              type="text"
              value={targetAmount}
              onChange={(e) => setTargetAmount(sanitizeAmountInput(e.target.value))}
              placeholder="0,00"
              disabled={isSaving}
              className="w-full h-[60px] bg-indigo-500/5 border-2 border-indigo-500/30 rounded-2xl px-6 text-xl font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-white"
            />
          </div>
        )}

        {/* Entity / Payee (not for transfer) */}
        {entryType !== 'transfer' && (
          <SearchableSelect
            label="Entity / Payee"
            options={payeeOptions}
            value={payee}
            onChange={(val) => handlePayeeChange(val)}
            placeholder="Who are you paying?"
            onAddNew={(name) => {
              handlePayeeChange(name);
              // Ensure it's selected
              setPayee(name);
            }}
            className="w-full"
          />
        )}

        {/* Category (not for transfer) */}
        {entryType !== 'transfer' && (
          <>
            <SearchableSelect
              label="Main Category"
              options={mainCategoryOptions}
              value={mainCategoryId}
              onChange={(id) => {
                setMainCategoryId(id);
                setSubCategoryId(''); // Reset sub when main changes
              }}
              placeholder="Select Main Category"
              className="w-full"
              onAddNew={async (name) => {
                if (onCategoryCreate) {
                  const newId = await onCategoryCreate(name);
                  if (newId) {
                    setMainCategoryId(String(newId));
                    setSubCategoryId('');
                  }
                }
              }}
            />
            {mainCategoryId && subCategoryOptions.length > 0 && (
              <SearchableSelect
                label="Subcategory"
                options={subCategoryOptions}
                value={subCategoryId}
                onChange={setSubCategoryId}
                placeholder="Select Subcategory"
                className="w-full animate-in slide-in-from-top-2"
                onAddNew={async (name) => {
                  if (onCategoryCreate && mainCategoryId) {
                    const newId = await onCategoryCreate(name, parseInt(mainCategoryId));
                    if (newId) {
                      setSubCategoryId(String(newId));
                    }
                  }
                }}
              />
            )}
          </>
        )}

        {/* Payment Method (not for transfer) */}
        {entryType !== 'transfer' && (
          <SearchableSelect
            label="Payment Method"
            options={PAYMENT_OPTIONS}
            value={paymentType}
            onChange={setPaymentType}
            placeholder="Select method..."
            className="w-full"
          />
        )}

        {/* Memo */}
        <div className={entryType === 'transfer' ? 'md:col-span-2' : ''}>
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 px-2">
            Narrative / Memo
          </label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Add a brief description..."
            disabled={isSaving}
            className="w-full h-[60px] bg-slate-950/50 border border-slate-800 rounded-2xl px-6 text-sm font-black outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-white uppercase placeholder:lowercase"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <Button
          variant="primary"
          size="lg"
          onClick={handleSave}
          isLoading={isSaving}
          className="flex-1 h-[60px]"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
        >
          {mode === 'edit' ? 'Commit Update' : 'Finalize Record'}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={onCancel}
          disabled={isSaving}
          className="w-full sm:w-auto px-10 h-[60px]"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
