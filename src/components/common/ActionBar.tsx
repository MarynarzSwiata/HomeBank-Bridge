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

/**
 * Page header: title + subtitle on the left, secondary actions and the primary
 * "add" button on the right (wraps on narrow screens).
 */
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
    <header className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div className="flex-1 min-w-[200px]">
        {title && <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{title}</h1>}
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!!isExpanded}
          className={`min-h-[42px] px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${
            isExpanded
              ? 'bg-slate-900 border border-slate-700 text-slate-200 hover:bg-slate-950'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 5v14M5 12h14" />
          </svg>
          {isExpanded ? collapseLabel : expandLabel}
        </button>
      )}
    </header>
  );
};
