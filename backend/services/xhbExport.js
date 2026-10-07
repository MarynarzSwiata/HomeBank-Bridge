/**
 * Export of the app's data as a HomeBank .xhb file.
 *
 * Written in the layout HomeBank 5.10 saves (file format 1.6), which is the reverse of
 * services/xhbImport.js: GLib julian dates, transfers as two <ope> sharing kxfer
 * (with damt when the currencies differ), templates as <fav> with recflg="1" when scheduled.
 */
import db from '../db/index.js';

const GLIB_EPOCH_1970 = 719163;
const isoToJulian = (iso) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000) + GLIB_EPOCH_1970;

// Same escaping as GLib's g_markup_escape_text (plus control characters)
const esc = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f-\x84\x86-\x9f]/g, c => `&#x${c.charCodeAt(0).toString(16)};`);

const amt = (n) => String(Math.round(Number(n || 0) * 100) / 100);

/** One self-closing tag; attributes with undefined / null / '' / 0 (unless keep0) are left out, like HomeBank */
const tag = (name, attrs, keep0 = []) => {
  const parts = Object.entries(attrs)
    .filter(([k, v]) => v !== undefined && v !== null && v !== '' && (v !== 0 || keep0.includes(k)))
    .map(([k, v]) => `${k}="${typeof v === 'string' ? esc(v) : v}"`);
  return `<${name}${parts.length ? ' ' + parts.join(' ') : ''}/>`;
};

const ACCOUNT_TYPES = { bank: 1, cash: 2, asset: 3, creditcard: 4, liability: 5, checking: 6, savings: 7 };
const SCHEDULE_UNITS = { day: 0, week: 1, month: 2, year: 3 };

/** Number of occurrences from next_date up to end_date (for HomeBank's "stop after N") */
function occurrencesUntil(row, advanceDate) {
  let count = 0;
  let next = row.next_date;
  while (next <= row.end_date && count < 1000) {
    count++;
    next = advanceDate(next, row.every, row.unit, row.anchor_day);
  }
  return count;
}

export async function buildXhb({ advanceDate }) {
  const [accounts, categories, budgets, payeeRows, transactions, templates, rules, rateRows, baseRow] = await Promise.all([
    db.all('SELECT * FROM accounts ORDER BY id'),
    db.all('SELECT * FROM categories ORDER BY parent_id IS NOT NULL, id'),
    db.all('SELECT * FROM budgets'),
    db.all('SELECT * FROM payees ORDER BY id'),
    db.all('SELECT t.*, a.currency FROM transactions t JOIN accounts a ON a.id = t.account_id ORDER BY t.date, t.id'),
    db.all('SELECT * FROM scheduled ORDER BY id'),
    db.all('SELECT * FROM rules ORDER BY position, id'),
    db.all('SELECT code, rate FROM currency_rates'),
    db.get("SELECT value FROM app_settings WHERE key = 'base_currency'"),
  ]);

  // Currencies: base first so it gets key 1
  const rates = Object.fromEntries(rateRows.map(r => [r.code, r.rate]));
  const usedCurrencies = Array.from(new Set(accounts.map(a => a.currency)));
  const base = baseRow?.value && usedCurrencies.includes(baseRow.value) ? baseRow.value : usedCurrencies[0] || 'EUR';
  // Keep currencies that only have a rate (no account) too, so nothing is lost on a round trip
  const otherCodes = new Set([...usedCurrencies, ...Object.keys(rates)]);
  otherCodes.delete(base);
  const currencyCodes = [base, ...Array.from(otherCodes).sort()];
  const curKey = new Map(currencyCodes.map((c, i) => [c, i + 1]));

  // Payees: stored ones plus any payee text used on entries/templates (transfer labels are not payees)
  const payeeKey = new Map();
  const payees = [];
  const addPayee = (name, category = 0, paymode = 0) => {
    const clean = (name || '').trim();
    if (!clean || payeeKey.has(clean.toLowerCase())) return;
    payeeKey.set(clean.toLowerCase(), payees.length + 1);
    payees.push({ key: payees.length + 1, name: clean, category, paymode });
  };
  payeeRows.forEach(p => addPayee(p.name, p.default_category_id || 0, p.default_payment_type || 0));
  transactions.filter(t => !t.transfer_id).forEach(t => addPayee(t.payee));
  templates.filter(t => t.type !== 'transfer').forEach(t => addPayee(t.payee));
  const payeeOf = (name) => payeeKey.get((name || '').trim().toLowerCase()) || 0;

  // Tags used anywhere
  const tagNames = new Map();
  [...transactions, ...templates].forEach(r => (r.tags || '').split(' ').filter(Boolean).forEach(t => {
    if (!tagNames.has(t.toLowerCase())) tagNames.set(t.toLowerCase(), t);
  }));

  const lines = ['<?xml version="1.0"?>', '<homebank v="1.6000000000000001" d="051002">'];
  lines.push(tag('properties', { title: 'HomeBank Bridge', curr: 1, auto_smode: 1, auto_weekday: 1 }));

  currencyCodes.forEach(code => {
    const iso = /^[A-Z]{3}$/.test(code) ? code : '';
    lines.push(tag('cur', {
      key: curKey.get(code), flags: iso ? 0 : 2, iso, name: code, symb: code, syprf: 0,
      dchar: ',', gchar: ' ', frac: 2, rate: code === base ? 0 : (rates[code] || 0), mdate: 0,
    }, ['flags', 'syprf', 'rate', 'mdate', 'iso']));
  });

  accounts.forEach((a, i) => {
    const flags = (a.closed ? 1 << 1 : 0) | (a.no_summary ? 1 << 4 : 0) | (a.no_budget ? 1 << 5 : 0) | (a.no_report ? 1 << 6 : 0);
    lines.push(tag('account', {
      key: a.id, flags, pos: i + 1, type: ACCOUNT_TYPES[a.type] || 1, curr: curKey.get(a.currency),
      name: a.name, initial: amt(a.initial_balance), minimum: '0',
    }));
  });

  payees.forEach(p => lines.push(tag('pay', { key: p.key, name: p.name, category: p.category, paymode: p.paymode })));

  const budgetsByCat = new Map();
  budgets.forEach(b => {
    if (!budgetsByCat.has(b.category_id)) budgetsByCat.set(b.category_id, []);
    budgetsByCat.get(b.category_id).push(b);
  });
  categories.forEach(c => {
    const rows = budgetsByCat.get(c.id) || [];
    const sign = c.type === '+' ? 1 : -1; // HomeBank stores expense budgets as negative amounts
    const monthly = rows.some(r => r.month > 0);
    const attrs = { key: c.id, parent: c.parent_id || 0 };
    attrs.flags = (c.parent_id ? 1 : 0) | (c.type === '+' ? 1 << 1 : 0) | (rows.length ? 1 << 3 : 0) | (monthly ? 1 << 2 : 0);
    attrs.name = c.name;
    if (monthly) {
      const every = rows.find(r => r.month === 0)?.amount || 0;
      for (let m = 1; m <= 12; m++) {
        const v = rows.find(r => r.month === m)?.amount ?? every;
        if (v) attrs[`b${m}`] = amt(sign * v);
      }
    } else if (rows.length) {
      attrs.b0 = amt(sign * rows[0].amount);
    }
    lines.push(tag('cat', attrs));
  });

  Array.from(tagNames.values()).forEach((name, i) => lines.push(tag('tag', { key: i + 1, name })));

  rules.forEach((r, i) => {
    const flags = (r.match_type === 'exact' ? 1 : 0) | (r.category_id ? 1 << 2 : 0) | (r.payment_type ? 1 << 3 : 0);
    lines.push(tag('asg', {
      key: r.id, flags, field: r.field === 'memo' ? 0 : 1, pos: i + 1, name: r.pattern,
      category: r.category_id || 0, paymode: r.payment_type || 0,
    }));
  });

  templates.forEach(t => {
    const sign = t.type === 'expense' || t.type === 'transfer' ? -1 : 1;
    const attrs = {
      key: t.id, amount: amt(sign * t.amount), account: t.account_id,
      dst_account: t.type === 'transfer' ? t.target_account_id : 0,
      paymode: t.type === 'transfer' ? 4 : t.payment_type || 0,
      flags: t.type === 'income' ? 1 << 1 : 0,
      payee: t.type === 'transfer' ? 0 : payeeOf(t.payee),
      category: t.category_id || 0,
      wording: t.memo || t.name || '',
      tags: t.tags || '',
    };
    if (t.is_scheduled) {
      attrs.recflg = 1;
      if (t.end_date) {
        attrs.flags |= 1 << 7; // stop after `limit` occurrences
        attrs.limit = Math.max(1, occurrencesUntil(t, advanceDate));
      }
    }
    attrs.nextdate = isoToJulian(t.next_date);
    attrs.every = t.every;
    attrs.unit = SCHEDULE_UNITS[t.unit] ?? 2;
    lines.push(tag('fav', attrs, ['amount']));
  });

  // Transfers: both sides share one kxfer number
  const transferSides = new Map();
  transactions.filter(t => t.transfer_id).forEach(t => {
    if (!transferSides.has(t.transfer_id)) transferSides.set(t.transfer_id, []);
    transferSides.get(t.transfer_id).push(t);
  });
  const kxferOf = new Map();
  let kx = 0;
  for (const [id, sides] of transferSides) if (sides.length === 2) kxferOf.set(id, ++kx);

  transactions.forEach(t => {
    const pair = t.transfer_id && kxferOf.has(t.transfer_id) ? transferSides.get(t.transfer_id) : null;
    const other = pair ? pair.find(s => s.id !== t.id) : null;
    lines.push(tag('ope', {
      date: isoToJulian(t.date),
      amount: amt(t.amount),
      account: t.account_id,
      damt: other && other.currency !== t.currency ? amt(other.amount) : undefined,
      dst_account: other ? other.account_id : 0,
      paymode: other ? 4 : t.payment_type || 0,
      st: t.status || 0,
      flags: t.amount > 0 ? 1 << 1 : 0,
      payee: other ? 0 : payeeOf(t.payee),
      category: t.category_id || 0,
      wording: t.memo || (other ? '' : ''),
      tags: t.tags || '',
      kxfer: other ? kxferOf.get(t.transfer_id) : 0,
    }, ['amount']));
  });

  lines.push('</homebank>', '');
  return lines.join('\n');
}
