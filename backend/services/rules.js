import db from '../db/index.js';

/**
 * Assignment rules (HomeBank "Assignment rules"): when the payee and/or memo match,
 * suggest a category, payment type and tags. First matching rule wins (by position, then id).
 */
export const loadRules = () => db.all('SELECT * FROM rules ORDER BY position, id');

const matches = (rule, value) => {
  if (!value) return false;
  const text = String(value).trim().toLowerCase();
  const pattern = rule.pattern.trim().toLowerCase();
  if (!pattern) return false;
  return rule.match_type === 'exact' ? text === pattern : text.includes(pattern);
};

export function findRule(rules, { payee, memo }) {
  return rules.find(rule =>
    (rule.field === 'payee' && matches(rule, payee)) ||
    (rule.field === 'memo' && matches(rule, memo)) ||
    (rule.field === 'any' && (matches(rule, payee) || matches(rule, memo)))
  ) || null;
}
