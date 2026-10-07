/** Colour theme: the choice is stored per browser (a display convenience, not account data). */
export type ThemePref = 'light' | 'dark' | 'system';

const KEY = 'hb-theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export const getThemePref = (): ThemePref => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
};

export const applyTheme = (pref: ThemePref = getThemePref()) => {
  const dark = pref === 'dark' || (pref === 'system' && media().matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

export const setThemePref = (pref: ThemePref) => {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* storage blocked: the choice lasts for this page only */ }
  applyTheme(pref);
  window.dispatchEvent(new Event('hb-theme'));
};

/** Keeps the page in sync with the OS setting while "system" is selected. */
export const watchSystemTheme = () => {
  const m = media();
  const onChange = () => { if (getThemePref() === 'system') applyTheme('system'); };
  m.addEventListener('change', onChange);
  return () => m.removeEventListener('change', onChange);
};
