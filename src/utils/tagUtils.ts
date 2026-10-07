import type { Rule } from '../types';

/** Same rules as backend/services/tags.js: space-separated, de-duplicated, no CSV-breaking characters */
export const normalizeTags = (input: string): string => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of (input || '').split(/[\s,;]+/)) {
    const tag = piece.replace(/^#+/, '').replace(/[;"'\\]/g, '').slice(0, 40);
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
    if (out.length >= 20) break;
  }
  return out.join(' ');
};

export const splitTags = (tags: string | undefined | null): string[] => (tags ? tags.split(' ').filter(Boolean) : []);

export const mergeTags = (a: string, b: string) => normalizeTags(`${a || ''} ${b || ''}`);

const matches = (rule: Rule, value: string | undefined) => {
  const text = (value || '').trim().toLowerCase();
  const pattern = rule.pattern.trim().toLowerCase();
  if (!text || !pattern) return false;
  return rule.match_type === 'exact' ? text === pattern : text.includes(pattern);
};

/** First matching rule (rules come sorted by position from the API) - mirrors backend/services/rules.js */
export const findRule = (rules: Rule[], payee?: string, memo?: string): Rule | null =>
  rules.find(r =>
    (r.field === 'payee' && matches(r, payee)) ||
    (r.field === 'memo' && matches(r, memo)) ||
    (r.field === 'any' && (matches(r, payee) || matches(r, memo)))
  ) || null;
