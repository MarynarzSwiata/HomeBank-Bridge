import React, { useEffect, useState } from 'react';
import { ThemePref, getThemePref, setThemePref } from '../../utils/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
];

/** Light / Dark / Auto (follow the device) selector. */
export const ThemeSwitch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [pref, setPref] = useState<ThemePref>(getThemePref);

  // Keep several switches on screen in sync
  useEffect(() => {
    const sync = () => setPref(getThemePref());
    window.addEventListener('hb-theme', sync);
    return () => window.removeEventListener('hb-theme', sync);
  }, []);

  return (
    <div role="radiogroup" aria-label="Colour theme" className={`grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-950 border border-slate-800 ${className}`}>
      {OPTIONS.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={pref === o.value}
          onClick={() => setThemePref(o.value)}
          className={`min-h-[32px] rounded-md text-xs font-medium transition-colors ${
            pref === o.value ? 'bg-slate-900 text-slate-100 shadow-lg' : 'text-slate-500 hover:text-slate-100'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
