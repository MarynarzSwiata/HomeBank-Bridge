import React, { useState } from 'react';
import { AccountForm } from './AccountForm';
import type { Account } from '../../types';
import { 
  Button, 
  ActionBar, 
  Card, 
  ConfirmModal, 
  Alert 
} from '../common';
import { transactionsService } from '../../api/services';

interface AccountsViewProps {
  accounts: Account[];
  isAnonymized: boolean;
  createAccount: (data: { name: string; currency: string; initialBalance: number }) => Promise<number | null>;
  updateAccount: (id: number, data: { name?: string; currency?: string; initialBalance?: number }) => Promise<boolean>;
  deleteAccount: (id: number) => Promise<boolean>;
  isSaving: boolean;
  error: string | null;
  // TODO: implement deep linking
  viewAccountHistory?: (id: number) => void;
  currencies: string[];
  dateFormat: string;
  decimalSeparator: string;
  onExportLogged?: () => Promise<void>;
  onToggleAnonymize: () => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  isAnonymized,
  createAccount,
  updateAccount,
  deleteAccount,
  isSaving,
  error,
  viewAccountHistory,
  currencies,
  dateFormat,
  decimalSeparator,
  onExportLogged,
  onToggleAnonymize
}) => {
    const [isFormExpanded, setIsFormExpanded] = useState(false);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);

    const startEditing = (acc: Account) => {
        setEditingAccount(acc);
        setIsFormExpanded(true);
    };

    const resetForm = () => {
        setEditingAccount(null);
        setIsFormExpanded(false);
    };

    const handleDelete = async () => {
        if (!confirmDelete) return;
        const success = await deleteAccount(confirmDelete.id);
        if (success) {
            setConfirmDelete(null);
        }
    };

    const handleExportAccount = async (id: number) => {
        const acc = accounts.find(a => a.id === id);
        if (!acc) return;
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = acc.name.replace(/[/\\?%*:|"<>]/g, '-');
            await transactionsService.exportCSV({ 
                accountId: id,
                filename: `${safeName}-${dateStr}.csv`,
                dateFormat,
                decimalSeparator
            });
            if (onExportLogged) await onExportLogged();
        } catch (err) {
            console.error('Export failed', err);
        }
    };

    const handleExportAll = async () => {
        for (const acc of accounts) {
            // We call the service directly here to avoid individual refreshes
            const dateStr = new Date().toISOString().split('T')[0];
            const safeName = acc.name.replace(/[/\\?%*:|"<>]/g, '-');
            await transactionsService.exportCSV({ 
                accountId: acc.id,
                filename: `${safeName}-${dateStr}.csv`,
                dateFormat,
                decimalSeparator
            });
            await new Promise(r => setTimeout(r, 800)); 
        }
        if (onExportLogged) await onExportLogged();
    };
    
  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 space-y-12 max-w-5xl mx-auto">
      {/* Error Display */}
      {error && (
        <Alert 
          variant="error" 
          message={error} 
        />
      )}

      {/* Actions & Form Section */}
      <div className="space-y-4">
        <ActionBar
          title={editingAccount ? 'Edit Account' : isFormExpanded ? 'New Account' : 'Vault Management'}
          subtitle={editingAccount ? `Modifying ${editingAccount.name}` : 'Manage your financial roots'}
          isExpanded={isFormExpanded || !!editingAccount}
          onToggle={() => {
            if (editingAccount) resetForm();
            else setIsFormExpanded(!isFormExpanded);
          }}
          expandLabel="Add Account"
          collapseLabel={editingAccount ? "Cancel Edit" : "Close"}
          actions={
            <div className="flex gap-2">
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
                <span className="font-black text-[10px] uppercase tracking-widest hidden md:inline">{isAnonymized ? 'HIDDEN' : 'VISIBLE'}</span>
              </button>
              {accounts.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportAll}
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                >
                  Export All
                </Button>
              )}
            </div>
          }
          className={editingAccount ? 'border-indigo-500/50 bg-indigo-950/10' : ''}
        />

        {(isFormExpanded || editingAccount) && (
           <Card variant="default" className={editingAccount ? 'border-indigo-500/50 bg-indigo-950/5' : ''}>
             <AccountForm 
                isExpanded={true}
                onClose={() => setIsFormExpanded(false)}
                editingAccount={editingAccount}
                onSuccess={resetForm}
                createAccount={createAccount}
                updateAccount={updateAccount}
                isSaving={isSaving}
                error={error}
                currencies={currencies}
                inlineMode={true}
            />
           </Card>
        )}
      </div>

      <div className="space-y-2">
            {/* Header (Desktop Only) */}
            <div className="hidden md:grid grid-cols-12 gap-2 px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                <div className="col-span-6">Account / Vault</div>
                <div className="col-span-3 text-right">Liquidity</div>
                <div className="col-span-3 text-right">Actions</div>
            </div>

            {/* List */}
            {accounts.length === 0 ? (
                <div className="text-center py-24 bg-slate-900/20 border-2 border-dashed border-slate-800 rounded-[3rem]">
                    <p className="text-lg font-black uppercase tracking-widest text-slate-500">No Active Wallets</p>
                    <p className="text-xs font-bold text-slate-700 uppercase mt-2">Establish your first account to begin tracking.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {accounts.map(acc => (
                        <div 
                            key={acc.id} 
                            onClick={() => viewAccountHistory?.(acc.id)}
                            className="group relative rounded-[2.5rem] bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-800/40 transition-all cursor-pointer overflow-hidden"
                        >
                            {/* Desktop Layout */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-6 items-center">
                                <div className="col-span-6">
                                    <div className="text-sm font-black text-slate-100 uppercase tracking-tight truncate">
                                        {acc.name} <span className="text-indigo-400/60 ml-1 text-[10px]">({acc.currency})</span>
                                    </div>
                                </div>
                                <div className={`col-span-3 text-right text-base font-black tracking-tight ${
                                    acc.current_balance < 0 ? 'text-rose-400' : 'text-emerald-400'
                                }`}>
                                    {isAnonymized ? '••••••' : acc.current_balance.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    <span className="ml-1.5 text-[10px] text-slate-600 uppercase font-black">{acc.currency}</span>
                                </div>
                                <div className="col-span-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleExportAccount(acc.id); }} 
                                        className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-emerald-600 hover:text-white transition-all flex items-center justify-center shadow-lg" 
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); startEditing(acc); }} 
                                        className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-indigo-500 hover:text-white transition-all flex items-center justify-center shadow-lg" 
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setConfirmDelete(acc); }} 
                                        className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shadow-lg" 
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Mobile Layout */}
                            <div className="md:hidden flex flex-col p-6 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">Account / Vault</span>
                                        <span className="text-lg font-black text-slate-100 uppercase tracking-tight truncate leading-none">
                                            {acc.name}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); startEditing(acc); }} 
                                            className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-indigo-500 active:scale-90 transition-all flex items-center justify-center"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(acc); }} 
                                            className="w-10 h-10 rounded-xl bg-slate-800 text-slate-400 hover:bg-rose-500 active:scale-90 transition-all flex items-center justify-center"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex justify-between items-end bg-slate-950/30 rounded-2xl p-4 border border-slate-800/50">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Liquidity Status</span>
                                        <div className={`text-xl font-black tracking-tighter ${
                                            acc.current_balance < 0 ? 'text-rose-400' : 'text-emerald-400'
                                        }`}>
                                            {isAnonymized ? '••••••' : acc.current_balance.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            <span className="ml-2 text-[10px] text-slate-600 uppercase font-black">{acc.currency}</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleExportAccount(acc.id); }} 
                                        className="px-4 h-10 rounded-xl bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-700 active:scale-95 transition-all"
                                    >
                                        Export
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
      </div>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete Account?"
        message={
          <>
            Are you sure you want to delete <span className="text-white font-bold">{confirmDelete?.name}</span>? 
            This will permanently remove the account and all associated data.
          </>
        }
        confirmLabel="Confirm Erasure"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        isLoading={isSaving}
      />
    </div>
  );
};
