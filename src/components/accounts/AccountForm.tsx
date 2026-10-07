import React, { useState, useEffect } from 'react';
import SearchableSelect from '../shared/SearchableSelect';
import type { Account, AccountInput, AccountType } from '../../types';
import { ACCOUNT_TYPE_OPTIONS } from '../../constants';

interface AccountFormProps {
  isExpanded: boolean;
  onClose: () => void;
  editingAccount: Account | null;
  onSuccess: () => void;
  // Data props
  createAccount: (data: AccountInput) => Promise<number | null>;
  updateAccount: (id: number, data: Partial<AccountInput>) => Promise<boolean>;
  isSaving: boolean;
  error?: string | null;
  currencies: string[];
  inlineMode?: boolean;
}

export const AccountForm: React.FC<AccountFormProps> = ({
  isExpanded,
  onClose,
  editingAccount,
  onSuccess,
  createAccount,
  updateAccount,
  isSaving,
  error: hookError,
  currencies,
  inlineMode
}) => {
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('EUR');
    const [initialBalance, setInitialBalance] = useState('0');
    const [type, setType] = useState<AccountType>('bank');
    const [closed, setClosed] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Use passed currencies
    const currencyOptions = currencies.map(c => ({ id: c, name: c }));

    useEffect(() => {
        if (editingAccount) {
            setName(editingAccount.name);
            setCurrency(editingAccount.currency);
            setInitialBalance(String(editingAccount.initial_balance));
            setType(editingAccount.type);
            setClosed(editingAccount.closed);
        } else {
            setName('');
            setCurrency('EUR');
            setInitialBalance('0');
            setType('bank');
            setClosed(false);
        }
        setLocalError(null);
    }, [editingAccount, isExpanded]);

    const handleSubmit = async () => {
        if (!name.trim()) { setLocalError("Name is required"); return; }
        const bal = parseFloat(initialBalance.replace(',', '.'));
        if (isNaN(bal)) { setLocalError("Invalid balance"); return; }
        
        try {
            const payload = {
                name: name.trim(),
                currency,
                initialBalance: bal,
                type,
                closed
            };
            
            let success = false;
            if (editingAccount) {
                success = await updateAccount(editingAccount.id, payload);
            } else {
                const id = await createAccount(payload);
                success = !!id;
            }
            
            if (success) {
                onSuccess();
                if (!editingAccount) {
                    setName('');
                    setInitialBalance('0');
                    setType('bank');
                    setClosed(false);
                }
            }
        } catch (err) {
            console.error(err);
            setLocalError("Error saving account");
        }
    };
    
    const currentError = localError || hookError;

  return (
    <div className={`transition-all duration-700 ${
        inlineMode ? "" : "rounded-[3.5rem] border-2 shadow-2xl p-10"
    } ${
        editingAccount && !inlineMode
            ? "border-amber-500 bg-amber-950/10"
            : !inlineMode ? "border-indigo-500/30 bg-slate-900/30" : ""
        } relative z-[100]`}>
        
        {!inlineMode && (
            <div 
                onClick={onClose}
                className="w-full mb-8 flex justify-between items-center group transition-colors hover:bg-white/5 cursor-pointer rounded-2xl p-4">
                <div className="flex flex-col items-start gap-1">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                        {editingAccount ? "Edit Account" : "Add New Account"}
                    </h2>
                </div>
                <div className="flex gap-4 items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 group-hover:bg-indigo-600 transition-all ${isExpanded ? "rotate-45" : "rotate-0"}`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                    </div>
                </div>
            </div>
        )}
        
        <div className={`space-y-8 transition-all duration-500 ease-in-out ${isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 pointer-events-none p-0 overflow-hidden"}`}>
             {currentError && (
                 <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold">
                    {currentError}
                 </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                     <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1.5 block">Account Name</label>
                     <input 
                        placeholder="e.g. Main Checking"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl px-8 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none text-white h-[60px]"
                     />
                </div>
                <div>
                     <SearchableSelect 
                        label="Currency"
                        options={currencyOptions}
                        value={currency}
                        onChange={setCurrency}
                        placeholder="Currency"
                        showAllOption={false}
                        searchable={true}
                        onAddNew={(newCur) => {
                          // When user types a new currency, just set it as the value
                          // It will be added to the system when the account is created
                          setCurrency(newCur.toUpperCase());
                        }}
                     />
                </div>
                 <div>
                     <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-2 mb-1.5 block">Initial Balance</label>
                     <input 
                        type="text"
                        value={initialBalance}
                        onChange={(e) => setInitialBalance(e.target.value)}
                        className="w-full bg-slate-950/50 border border-slate-800 rounded-3xl px-8 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none text-white h-[60px]"
                     />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                     <SearchableSelect
                        label="Account Type"
                        options={ACCOUNT_TYPE_OPTIONS}
                        value={type}
                        onChange={(v) => setType((v || 'bank') as AccountType)}
                        placeholder="Type"
                        showAllOption={false}
                        searchable={false}
                     />
                </div>
                {editingAccount && (
                    <label className="md:col-span-2 flex items-center gap-4 h-[60px] mt-auto px-6 bg-slate-950/50 border border-slate-800 rounded-3xl cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={closed}
                            onChange={(e) => setClosed(e.target.checked)}
                            className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-indigo-600 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-300">
                            Closed account
                            <span className="block text-[10px] font-medium text-slate-500">Hidden from lists and new entries; history is kept.</span>
                        </span>
                    </label>
                )}
            </div>
            
             <div className="flex gap-4 mt-8">
                <button
                    onClick={handleSubmit}
                    disabled={!name || isSaving}
                    className="flex-1 py-6 rounded-[2.5rem] font-black uppercase tracking-[0.6em] text-[11px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-20 bg-indigo-600 shadow-indigo-600/30 text-white flex justify-center items-center gap-2"
                >
                    {isSaving ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                            Processing
                        </>
                    ) : editingAccount ? "Commit Update" : "Establish Account"}
                </button>
                {editingAccount && (
                    <button
                        onClick={() => { onSuccess(); onClose(); }}
                        disabled={isSaving}
                        className="px-10 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-[10px] bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};
