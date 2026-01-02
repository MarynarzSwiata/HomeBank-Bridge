import React from 'react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  itemName: string;
  itemType: 'category' | 'payee' | 'account' | 'transaction' | string;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  itemName,
  itemType
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 backdrop-blur-md bg-slate-950/60 animate-in fade-in duration-300">
      <div className="bg-slate-900 border-2 border-rose-500/50 p-6 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] shadow-2xl max-w-md w-full space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-rose-500/10 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center text-rose-500">
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        <div className="text-center space-y-4">
          <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
            Confirm Purge
          </h3>
          <p className="text-slate-400 text-xs sm:text-sm font-medium leading-relaxed">
            Are you absolutely certain you want to delete{" "}
            <span className="text-rose-400 font-bold">
              "{itemName}"
            </span>
            ? <br />
            <br />
            {itemType === "category"
              ? "All associated transaction tags and subcategories will be unlinked."
              : itemType === "payee"
              ? "This entity will be removed from the dictionary."
              : "The selected record will be permanently erased."}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            className="w-full py-5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl sm:rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] shadow-xl shadow-rose-600/20 transition-all active:scale-95"
          >
            Confirm Erasure
          </button>
          <button
            onClick={onCancel}
            className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl sm:rounded-3xl font-black uppercase tracking-[0.3em] text-[10px] transition-all"
          >
            Abort
          </button>
        </div>
      </div>
    </div>
  );
};
