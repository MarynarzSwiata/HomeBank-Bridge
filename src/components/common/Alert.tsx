import React from 'react';

interface AlertProps {
  variant?: 'info' | 'error';
  message: string;
  onClear?: () => void;
}

export const Alert: React.FC<AlertProps> = ({ variant = 'info', message, onClear }) => {
  const styles = variant === 'error' 
    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' 
    : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400';

  return (
    <div className={`border rounded-xl px-4 py-3 flex justify-between items-center ${styles}`}>
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm font-bold">{message}</span>
      </div>
      {onClear && (
        <button
          onClick={onClear}
          className="hover:opacity-70 text-sm font-black p-1 transition-all"
          title="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
};
