import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';

interface DrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Side panel for forms (full screen on phones). Rendered into <body> so it sits
 * above the mobile nav; closes with Esc, the X button or a click on the backdrop.
 */
export const Drawer: React.FC<DrawerProps> = ({ open, title, onClose, children }) => {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex justify-end">
      <button
        type="button"
        aria-label="Close form"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/30 cursor-default"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full sm:w-[480px] h-full overflow-y-auto bg-slate-900 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4 bg-slate-900 border-b border-slate-800">
          <h2 id={titleId} className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-950 text-slate-400 hover:text-slate-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeWidth="2.2" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </aside>
    </div>,
    document.body
  );
};
