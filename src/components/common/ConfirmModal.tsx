import React from 'react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-start justify-center p-6 pt-24 backdrop-blur-md bg-slate-950/60 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div className={`bg-slate-900 border-2 ${variant === 'danger' ? 'border-rose-500/50' : 'border-indigo-500/50'} p-10 rounded-[3rem] shadow-2xl max-w-md w-full space-y-8 animate-in slide-in-from-top-4 duration-500`}>
        <div className="flex justify-center">
          <div className={`w-20 h-20 ${variant === 'danger' ? 'bg-rose-500/10 text-rose-500' : 'bg-indigo-500/10 text-indigo-500'} rounded-[2rem] flex items-center justify-center`}>
            {variant === 'danger' ? (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            ) : (
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </div>
        
        <div className="text-center space-y-4">
          <h3 id="modal-title" className="text-2xl font-black text-white uppercase tracking-tight">
            {title}
          </h3>
          <div id="modal-description" className="text-slate-400 text-sm font-medium leading-relaxed">
            {message}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant={variant}
            size="lg"
            isLoading={isLoading}
            onClick={onConfirm}
            className="w-full"
          >
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            disabled={isLoading}
            onClick={onCancel}
            className="w-full"
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
