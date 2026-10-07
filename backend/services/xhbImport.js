/**
 * Import of HomeBank's native .xhb file (XML).
 *
 * Format reference: HomeBank hb-xml.c, as documented by the node-xhb project
 * (https://github.com/hertzg/node-xhb). Every element is a flat, self-closing tag
 * with attributes, so a small attribute scanner is enough - no XML dependency.
 *
 * What maps where:
 *   cur      -> account currency code (ISO, or the name for custom currencies)
 *   account  -> accounts (type, closed flag, initial balance)
 *   cat      -> categories (parent, income/expense) and budgets (b0 = every month, b1..b12 = per month)
 *   pay      -> payees (default category / payment)
 *   ope      -> transactions (status, tags, info, splits, transfers paired by kxfer)
 *   fav      -> scheduled transactions (only templates flagged as scheduled)
 *   asg      -> assignment rules (regex rules are skipped)
 */
import db from '../db/index.js';
import { normalizeTags } from './tags.js';
import { advanceDate } from '../routes/scheduled.js';

const MAX_FILE_BYTES = 20 * 1024 * 1024;

// --- XML scanning ---------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const parseAttrs = (raw) => {
  const attrs = {};
  for (const m of raw.matchAll(/([\w.]+)="([^"]*)"/g)) attrs[m[1]] = decode(m[2]);
  return attrs;
};

const WANTED = new Set(['homebank', 'properties', 'cur', 'account', 'pay', 'cat', 'tag', 'asg', 'fav', 'ope']);

export function parseXhb(text) {
  if (typeof text !== 'string' || text.length === 0) throw userError('The file is empty');
  if (text.length > MAX_FILE_BYTES) throw userError('The file is too large (max 20 MB)');
  if (!/<homebank[\s>]/.test(text)) throw userError('This is not a HomeBank (.xhb) file');

  const out = { cur: [], account: [], pay: [], cat: [], tag: [], asg: [], fav: [], ope: [], homebank: null, properties: null };
  for (const m of text.matchAll(/<([a-z]+)(\s[^<>]*?)?\/?>/g)) {
    const tag = m[1];
    if (!WANTED.has(tag)) continue;
    const attrs = parseAttrs(m[2] || '');
    if (tag === 'homebank' || tag === 'properties') out[tag] = attrs;
    else out[tag].push(attrs);
  }
  return out;
}

// --- Value helpers --------------------------------------------------------

const int = (v) => (v === undefined || v === '' ? 0 : parseInt(v, 10) || 0);
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

// GLib julian day: day 1 = 0001-01-01; 1970-01-01 = 719163
const GLIB_EPOCH_1970 = 719163;
export const julianToISO = (j) => {
  const d = int(j);
  if (d <= 0) return null;
  return new Date((d - GLIB_EPOCH_1970) * 86400000).toISOString().slice(0, 10);
};

const ACCOUNT_TYPES = { 0: 'bank', 1: 'bank', 2: 'cash', 3: 'asset', 4: 'creditcard', 5: 'liability', 6: 'checking', 7: 'savings' };
const ACCOUNT_CLOSED = 1 << 1;
const ACCOUNT_NOSUMMARY = 1 << 4;
const ACCOUNT_NOBUDGET = 1 << 5;
const ACCOUNT_NOREPORT = 1 << 6;
const CAT_INCOME = 1 << 1;
const CAT_CUSTOM = 1 << 2; // budget differs per month
const CAT_BUDGET = 1 << 3;
const OPE_INCOME = 1 << 1;
const FAV_AUTO = 1 << 2; // template is scheduled
const FAV_LIMIT = 1 << 7; // stop after `limit` occurrences
const ASG_EXACT = 1 << 0;
const ASG_DOCAT = 1 << 2;
const ASG_DOMOD = 1 << 3;
const ASG_REGEX = 1 << 8;
const SCHEDULE_UNITS = { 0: 'day', 1: 'week', 2: 'month', 3: 'year' };
const STATUS_VOID = 4;

// Internal transfer (5) is shown as bank transfer (4) in this app
const payMode = (v) => {
  const p = int(v);
  return p === 5 ? 4 : p;
};

function userError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// --- Plan: everything that would be imported, computed without touching the DB ---

export function buildPlan(xhb) {
  const warnings = [];
  const currencies = new Map(xhb.cur.map(c => [int(c.key), (c.iso || c.name || 'XXX').slice(0, 10)]));

  const accounts = xhb.account.map(a => ({
    key: int(a.key),
    name: a.name || `Account ${a.key}`,
    currency: currencies.get(int(a.curr)) || 'EUR',
    initial: num(a.initial),
    type: ACCOUNT_TYPES[int(a.type)] || 'bank',
    closed: (int(a.flags) & ACCOUNT_CLOSED) !== 0,
    noSummary: (int(a.flags) & ACCOUNT_NOSUMMARY) !== 0,
    noBudget: (int(a.flags) & ACCOUNT_NOBUDGET) !== 0,
    noReport: (int(a.flags) & ACCOUNT_NOREPORT) !== 0,
  }));
  const accountKeys = new Set(accounts.map(a => a.key));

  // Parents first so children can link to them
  const cats = xhb.cat.map(c => ({
    key: int(c.key),
    parent: int(c.parent),
    name: c.name || `Category ${c.key}`,
    type: int(c.flags) & CAT_INCOME ? '+' : '-',
    flags: int(c.flags),
    budget: c,
  })).sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0));

  const budgets = [];
  for (const c of cats) {
    if (!(c.flags & CAT_BUDGET)) continue;
    if (c.flags & CAT_CUSTOM) {
      for (let m = 1; m <= 12; m++) {
        const v = Math.abs(num(c.budget[`b${m}`]));
        if (v > 0) budgets.push({ catKey: c.key, month: m, amount: v });
      }
    } else {
      const v = Math.abs(num(c.budget.b0));
      if (v > 0) budgets.push({ catKey: c.key, month: 0, amount: v });
    }
  }

  const payees = xhb.pay.map(p => ({ key: int(p.key), name: (p.name || '').trim(), catKey: int(p.category), paymode: int(p.paymode) }))
    .filter(p => p.name);
  const payeeName = new Map(payees.map(p => [p.key, p.name]));

  // Transactions
  const transactions = [];
  let skippedVoid = 0;
  let skippedNoAccount = 0;
  let splitCount = 0;
  const transferSides = new Map();
  for (const o of xhb.ope) {
    const accountKey = int(o.account);
    if (!accountKeys.has(accountKey)) { skippedNoAccount++; continue; }
    const status = int(o.st);
    if (status === STATUS_VOID) { skippedVoid++; continue; }
    const date = julianToISO(o.date);
    if (!date) { skippedNoAccount++; continue; }
    const memoParts = [o.wording, o.info].map(s => (s || '').trim()).filter(Boolean);
    const base = {
      accountKey,
      date,
      payee: payeeName.get(int(o.payee)) || '',
      amount: num(o.amount),
      catKey: int(o.category),
      paymode: payMode(o.paymode),
      memo: memoParts.join(' · '),
      // "remind" (3) has no equivalent: keep the entry, mark it with a tag
      status: status === 1 || status === 2 ? status : 0,
      tags: normalizeTags(`${o.tags || ''}${status === 3 ? ' remind' : ''}`),
    };

    const kxfer = int(o.kxfer);
    if (kxfer > 0 && int(o.dst_account) > 0) {
      const side = { ...base, dstKey: int(o.dst_account) };
      if (!transferSides.has(kxfer)) transferSides.set(kxfer, []);
      transferSides.get(kxfer).push(side);
      continue;
    }

    if (o.scat || o.samt) {
      // Split: one entry per part, so categories and totals stay right
      const cats = (o.scat || '').split('||');
      const amts = (o.samt || '').split('||');
      const mems = (o.smem || '').split('||');
      splitCount++;
      cats.forEach((cat, i) => {
        transactions.push({
          ...base,
          amount: num(amts[i]),
          catKey: int(cat),
          memo: [mems[i]?.trim(), base.memo].filter(Boolean).join(' · '),
          tags: normalizeTags(`${base.tags} split`),
        });
      });
      continue;
    }
    transactions.push(base);
  }

  // Transfers: both sides found -> linked pair; one side only -> plain entry
  const transfers = [];
  let unpairedTransfers = 0;
  for (const sides of transferSides.values()) {
    const out = sides.find(s => s.amount < 0) || sides[0];
    const into = sides.find(s => s !== out);
    if (into && into.accountKey === out.dstKey) {
      transfers.push({ from: out, to: into });
    } else {
      sides.forEach(s => transactions.push({ ...s, tags: normalizeTags(`${s.tags} transfer`) }));
      unpairedTransfers += sides.length;
    }
  }

  // Templates ("fav"). Scheduled ones are flagged either by FAV_AUTO (older files)
  // or by recflg bit 0 (HomeBank 5.9+); the rest are plain templates for quick entry.
  const scheduled = [];
  let skippedTemplates = 0;
  const todayISO = new Date().toISOString().slice(0, 10);
  for (const f of xhb.fav) {
    const flags = int(f.flags);
    const accountKey = int(f.account);
    if (!accountKeys.has(accountKey)) { skippedTemplates++; continue; }
    const isScheduled = (flags & FAV_AUTO) !== 0 || (int(f.recflg) & 1) !== 0;
    const next = julianToISO(f.nextdate) || todayISO;
    const unit = SCHEDULE_UNITS[int(f.unit)] || 'month';
    const every = Math.min(Math.max(int(f.every), 1), 366);
    const amount = num(f.amount);
    const dst = int(f.dst_account);
    const isTransfer = dst > 0 && accountKeys.has(dst) && dst !== accountKey;
    let endDate = null;
    if (isScheduled && flags & FAV_LIMIT && int(f.limit) > 0) {
      // Last occurrence = next date advanced (limit - 1) times
      endDate = next;
      const anchor = Number(next.slice(8, 10));
      for (let i = 1; i < Math.min(int(f.limit), 1000); i++) endDate = advanceDate(endDate, every, unit, anchor);
    }
    scheduled.push({
      type: isTransfer ? 'transfer' : amount < 0 ? 'expense' : (flags & OPE_INCOME || amount > 0 ? 'income' : 'expense'),
      accountKey,
      dstKey: isTransfer ? dst : null,
      amount: Math.abs(amount),
      payee: isTransfer ? '' : (payeeName.get(int(f.payee)) || ''),
      catKey: isTransfer ? 0 : int(f.category),
      paymode: payMode(f.paymode),
      memo: (f.wording || '').trim(),
      tags: normalizeTags(f.tags || ''),
      every,
      unit,
      next,
      endDate,
      isScheduled,
    });
  }

  // Assignment rules
  const rules = [];
  let skippedRules = 0;
  xhb.asg.forEach((a, i) => {
    let flags = int(a.flags);
    // Files before format 0.8 had no action flags: category and payee were always set
    if (parseFloat(xhb.homebank?.v || '1') <= 0.7) flags = ASG_DOCAT | (int(a.exact) ? ASG_EXACT : 0);
    const pattern = (a.name || '').trim();
    const catKey = flags & ASG_DOCAT ? int(a.category) : 0;
    const paymode = flags & ASG_DOMOD ? payMode(a.paymode) : 0;
    if (!pattern || flags & ASG_REGEX || (!catKey && !paymode)) { skippedRules++; return; }
    rules.push({
      field: int(a.field) === 0 ? 'memo' : 'payee',
      matchType: flags & ASG_EXACT ? 'exact' : 'contains',
      pattern: pattern.slice(0, 200),
      catKey,
      paymode,
      position: i,
    });
  });

  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const stale = scheduled.filter(s => s.isScheduled && s.next < yearAgo).length;
  if (stale) warnings.push(`${stale} scheduled item(s) have a next date more than a year ago - check them in Scheduled before posting`);
  if (skippedVoid) warnings.push(`${skippedVoid} void transaction(s) skipped`);
  if (skippedNoAccount) warnings.push(`${skippedNoAccount} transaction(s) without a valid account or date skipped`);
  if (unpairedTransfers) warnings.push(`${unpairedTransfers} transfer half(s) without a matching side imported as normal entries (tag "transfer")`);
  if (splitCount) warnings.push(`${splitCount} split transaction(s) imported as one entry per part (tag "split")`);
  if (skippedTemplates) warnings.push(`${skippedTemplates} template(s) without a valid account skipped`);
  if (skippedRules) warnings.push(`${skippedRules} assignment rule(s) skipped (regex, or nothing this app can assign)`);

  // Base currency (properties curr) and exchange rates: rate = units of that currency per 1 base unit
  const baseCurrency = currencies.get(int(xhb.properties?.curr)) || '';
  const rates = {};
  for (const c of xhb.cur) {
    const code = currencies.get(int(c.key));
    const rate = parseFloat(c.rate);
    if (code && code !== baseCurrency && Number.isFinite(rate) && rate > 0) rates[code] = rate;
  }

  return { accounts, categories: cats, budgets, payees, transactions, transfers, scheduled, rules, warnings, baseCurrency, rates };
}

export const planSummary = (plan) => ({
  accounts: plan.accounts.length,
  categories: plan.categories.length,
  payees: plan.payees.length,
  transactions: plan.transactions.length + plan.transfers.length * 2,
  transfers: plan.transfers.length,
  budgets: plan.budgets.length,
  scheduled: plan.scheduled.filter(s => s.isScheduled).length,
  templates: plan.scheduled.filter(s => !s.isScheduled).length,
  rules: plan.rules.length,
  currencies: Array.from(new Set(plan.accounts.map(a => a.currency))),
  baseCurrency: plan.baseCurrency,
  rates: plan.rates,
  warnings: plan.warnings,
});

// --- Write ----------------------------------------------------------------

const DATA_TABLES = ['transactions', 'scheduled', 'rules', 'budgets', 'payees', 'accounts', 'categories', 'currency_rates'];

export async function hasExistingData() {
  const row = await db.get('SELECT (SELECT COUNT(*) FROM accounts) + (SELECT COUNT(*) FROM transactions) + (SELECT COUNT(*) FROM categories) AS n');
  return row.n > 0;
}

/** Writes the plan in one DB transaction. With replace=true existing finance data is removed first. */
export async function applyPlan(plan, { replace }) {
  await db.exec('BEGIN TRANSACTION');
  try {
    if (replace) {
      for (const table of DATA_TABLES) await db.run(`DELETE FROM ${table}`);
    }

    const accountId = new Map();
    for (const a of plan.accounts) {
      const r = await db.run(
        `INSERT INTO accounts (name, currency, initial_balance, type, closed, no_summary, no_budget, no_report)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        a.name, a.currency, a.initial, a.type, a.closed ? 1 : 0, a.noSummary ? 1 : 0, a.noBudget ? 1 : 0, a.noReport ? 1 : 0
      );
      accountId.set(a.key, r.lastID);
    }

    if (plan.baseCurrency) {
      await db.run("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('base_currency', ?)", plan.baseCurrency);
    }
    for (const [code, rate] of Object.entries(plan.rates)) {
      await db.run('INSERT OR REPLACE INTO currency_rates (code, rate) VALUES (?, ?)', code, rate);
    }

    const categoryId = new Map();
    for (const c of plan.categories) {
      const r = await db.run(
        'INSERT INTO categories (name, type, parent_id) VALUES (?, ?, ?)',
        c.name, c.type, categoryId.get(c.parent) ?? null
      );
      categoryId.set(c.key, r.lastID);
    }
    const cat = (key) => (key ? categoryId.get(key) ?? null : null);

    for (const b of plan.budgets) {
      const id = cat(b.catKey);
      if (id) await db.run('INSERT OR REPLACE INTO budgets (category_id, month, amount) VALUES (?, ?, ?)', id, b.month, b.amount);
    }

    const seenPayees = new Set();
    for (const p of plan.payees) {
      if (seenPayees.has(p.name.toLowerCase())) continue; // payees.name is UNIQUE
      seenPayees.add(p.name.toLowerCase());
      await db.run(
        'INSERT OR IGNORE INTO payees (name, default_category_id, default_payment_type) VALUES (?, ?, ?)',
        p.name, cat(p.catKey), p.paymode || null
      );
    }

    for (const t of plan.transactions) {
      await db.run(
        `INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, memo, status, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        accountId.get(t.accountKey), t.date, t.payee, t.amount, cat(t.catKey), t.paymode, t.memo, t.status, t.tags
      );
    }

    const transferCategory = await db.get("SELECT id FROM categories WHERE name='Internal Transfer' LIMIT 1");
    const names = new Map(plan.accounts.map(a => [a.key, a.name]));
    let n = 0;
    for (const { from, to } of plan.transfers) {
      const uuid = `xhb-${Date.now()}-${n++}`;
      for (const [side, label] of [[from, `Transfer to ${names.get(from.dstKey)}`], [to, `Transfer from ${names.get(to.dstKey)}`]]) {
        await db.run(
          `INSERT INTO transactions (account_id, date, payee, amount, category_id, payment_type, transfer_id, memo, status, tags)
           VALUES (?, ?, ?, ?, ?, 4, ?, ?, ?, ?)`,
          accountId.get(side.accountKey), side.date, label, side.amount, transferCategory?.id ?? null, uuid, side.memo, side.status, side.tags
        );
      }
    }

    for (const s of plan.scheduled) {
      await db.run(
        `INSERT INTO scheduled (type, account_id, target_account_id, amount, payee, category_id, payment_type, memo,
                                every, unit, next_date, anchor_day, end_date, is_scheduled, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        s.type, accountId.get(s.accountKey), s.dstKey ? accountId.get(s.dstKey) : null, s.amount, s.payee,
        cat(s.catKey), s.paymode, s.memo, s.every, s.unit, s.next, Number(s.next.slice(8, 10)), s.endDate,
        s.isScheduled ? 1 : 0, s.tags
      );
    }

    for (const r of plan.rules) {
      await db.run(
        'INSERT INTO rules (field, match_type, pattern, category_id, payment_type, tags, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
        r.field, r.matchType, r.pattern, cat(r.catKey), r.paymode || null, '', r.position
      );
    }

    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  }
}
