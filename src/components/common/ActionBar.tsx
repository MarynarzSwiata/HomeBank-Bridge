import React from 'react';

interface ActionBarProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  isExpanded?: boolean;
  onToggle?: () => void;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  title,
  subtitle,
  actions,
  isExpanded,
  onToggle,
  expandLabel = 'Add New',
  collapseLabel = 'Close',
  className = '',
}) => {
  return (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-3xl transition-all duration-300 ${className}`}>
      <div className="flex flex-col md:flex-row md:divide-x md:divide-slate-800">
        <div className="hidden md:flex flex-1 px-6 py-4 flex-col justify-center">
          {title && <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</h2>}
          {subtitle && <p className="text-[10px] font-bold text-slate-600 mt-1 uppercase">{subtitle}</p>}
        </div>

        {onToggle && (
          <button
            onClick={onToggle}
            className="px-6 py-4 flex items-center justify-between md:justify-start gap-3 hover:bg-white/5 transition-colors group"
            title={isExpanded ? collapseLabel : expandLabel}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">
              {isExpanded ? collapseLabel : expandLabel}
            </span>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center bg-slate-800 transition-transform duration-500 ${isExpanded ? 'rotate-45 bg-rose-500/10' : 'group-hover:bg-indigo-500'}`}>
              <svg className={`w-4 h-4 transition-colors ${isExpanded ? 'text-rose-500' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
          </button>
        )}

        {actions && (
          <div className="flex items-center justify-center md:justify-end px-4 py-3 md:py-0 border-t border-slate-800 md:border-t-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
