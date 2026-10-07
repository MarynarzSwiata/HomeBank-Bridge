import React, { useMemo, useState } from 'react';
import type { Account, Category, Payee, ScheduledInput, ScheduledItem, ScheduleUnit } from '../../types';
import type { UseScheduledResult } from '../../hooks/useScheduled';
import { Alert, ConfirmModal } from '../common';
import { PAYMENT_OPTIONS } from '../../constants';
import { formatDateForDisplay } from '../../utils/dateUtils';
import { formatMoney, toISO } from '../../utils/periodUtils';
import { scheduledService } from '../../api';

/**
 * Templates and scheduled (recurring) transactions, like HomeBank's "Manage scheduled/template" list.
 * A template pre-fills new entries; a scheduled item also repeats on a date.
 * Nothing is posted automatically: due items are posted (or skipped) by the user,
 * which avoids duplicates when the app is open on several computers.
 */

interface ScheduledViewProps {
  scheduled: UseScheduledResult;
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  dateFormat: string;
  isAnonymized: boolean;
}

const UNIT_LABEL: Record<ScheduleUnit, [string, string]> = {
  day: ['day', 'days'],
  week: ['week', 'weeks'],
  month: ['month', 'months'],
  year: ['year', 'years'],
};

export const describeRepeat = (item: Pick<ScheduledItem, 'every' | 'unit'>) =>
  item.every === 1 ? `Every ${UNIT_LABEL[item.unit][0]}` : `Every ${item.every} ${UNIT_LABEL[item.unit][1]}`;

export const describeItem = (item: ScheduledItem) =>
  item.name ? item.name
  : item.type === 'transfer'
    ? `${item.account_name} → ${item.target_account_name || '?'}`
    : item.payee || item.category_name || '(no payee)';

export const ScheduledView: React.FC<ScheduledViewProps> = ({ scheduled, accounts, categories, payees, dateFormat, isAnonymized }) => {
  // 'new-scheduled' / 'new-template' open an empty form of that kind
  const [editing, setEditing] = useState<ScheduledItem | 'new-scheduled' | 'new-template' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ScheduledItem | null>(null);
  const today = toISO(new Date());
  const fmt = (v: number) => formatMoney(v, isAnonymized);

  const recurring = scheduled.items.filter(i => i.is_scheduled);
  const templates = scheduled.items
    .filter(i => !i.is_scheduled)
    .sort((a, b) => describeItem(a).localeCompare(describeItem(b)));
  const dueCount = recurring.filter(i => !i.finished && i.next_date <= today).length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 max-w-6xl mx-auto">
      {scheduled.error && <Alert variant="error" message={scheduled.error} />}

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Templates &amp; scheduled</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            Scheduled: recurring bills and income, posted when due. Templates: pick one in the entry form to fill it in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          {dueCount > 0 && <PostAllDueButton scheduled={scheduled} dueCount={dueCount} />}
          <button
            onClick={() => setEditing('new-template')}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700"
          >
            + Add template
          </button>
          <button
            onClick={() => setEditing('new-scheduled')}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white"
          >
            + Add scheduled
          </button>
        </div>
      </div>

      {editing && (
        <ScheduledForm
          key={typeof editing === 'string' ? editing : editing.id}
          item={typeof editing === 'string' ? null : editing}
          defaultScheduled={editing !== 'new-template'}
          accounts={accounts}
          categories={categories}
          payees={payees}
          isSaving={scheduled.isSaving}
          onCancel={() => setEditing(null)}
          onSave={async data => {
            const ok = await scheduled.save(data, typeof editing === 'string' ? undefined : editing.id);
            if (ok) setEditing(null);
          }}
        />
      )}

      {[
        { title: `Scheduled (${recurring.length})`, items: recurring, empty: 'No scheduled transactions yet. Add rent, salary or subscriptions here.' },
        { title: `Templates (${templates.length})`, items: templates, empty: 'No templates yet. A template fills in the entry form for repeated purchases.' },
      ].map(sectionDef => (
      <section key={sectionDef.title} className="p-4 md:p-8 bg-slate-900 border border-slate-800 rounded-[2rem]">
        <h3 className="px-2 pb-2 text-[13px] font-medium text-slate-500">{sectionDef.title}</h3>
        {sectionDef.items.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">{sectionDef.empty}</p>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {sectionDef.items.map(item => {
              const due = !!item.is_scheduled && !item.finished && item.next_date <= today;
              const signed = item.type === 'expense' ? -item.amount : item.amount;
              return (
                <li key={item.id} className={`py-4 px-2 flex flex-col md:flex-row md:items-center gap-3 ${item.finished ? 'opacity-50' : ''}`}>
                  {item.is_scheduled && (
                  <div className="md:w-40 shrink-0">
                    <div className="text-sm font-black text-slate-100 tabular-nums">{formatDateForDisplay(item.next_date, dateFormat)}</div>
                    {item.finished ? (
                      <span className="text-[13px] font-medium text-slate-500">Ended</span>
                    ) : due ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {item.next_date < today ? 'Overdue' : 'Due today'}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-500">Next</span>
                    )}
                  </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-100 truncate">{describeItem(item)}</div>
                    <div className="text-[10px] font-bold text-slate-500 truncate">
                      {item.is_scheduled ? describeRepeat(item) : item.type}
                      {item.is_scheduled && item.end_date ? ` · until ${formatDateForDisplay(item.end_date, dateFormat)}` : ''}
                      {item.type !== 'transfer' ? ` · ${item.account_name}` : ''}
                      {item.category_name ? ` · ${item.category_name}` : ''}
                    </div>
                  </div>
                  <div className={`md:w-36 md:text-right text-base font-black tabular-nums ${item.type === 'transfer' ? 'text-indigo-300' : signed < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {item.type === 'transfer' ? '' : signed < 0 ? '−' : '+'}{fmt(item.amount)} <span className="text-[10px] text-slate-500">{item.currency}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {!!item.is_scheduled && !item.finished && (
                      <>
                        <button
                          onClick={() => scheduled.post(item.id)}
                          disabled={scheduled.isSaving}
                          title="Add this occurrence to the ledger and move to the next date"
                          className="px-3 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/40 disabled:opacity-40"
                        >
                          Post
                        </button>
                        <button
                          onClick={() => scheduled.skip(item.id)}
                          disabled={scheduled.isSaving}
                          title="Skip this occurrence without adding it"
                          className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 disabled:opacity-40"
                        >
                          Skip
                        </button>
                      </>
                    )}
                    <button onClick={() => setEditing(item)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white">
                      Edit
                    </button>
                    <button onClick={() => setConfirmDelete(item)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white">
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      ))}

      <ConfirmModal
        isOpen={!!confirmDelete}
        title={confirmDelete?.is_scheduled ? 'Delete scheduled transaction?' : 'Delete template?'}
        message={<><span className="text-slate-100 font-bold">{confirmDelete ? describeItem(confirmDelete) : ''}</span> will be removed. Transactions already in the ledger stay.</>}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (confirmDelete && (await scheduled.remove(confirmDelete.id)) !== null) setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
        isLoading={scheduled.isSaving}
      />
    </div>
  );
};

const ScheduledForm: React.FC<{
  item: ScheduledItem | null;
  defaultScheduled: boolean;
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  isSaving: boolean;
  onCancel: () => void;
  onSave: (data: ScheduledInput) => void;
}> = ({ item, defaultScheduled, accounts, categories, payees, isSaving, onCancel, onSave }) => {
  const openAccounts = accounts.filter(a => !a.closed || a.id === item?.account_id || a.id === item?.target_account_id);
  const [type, setType] = useState<ScheduledItem['type']>(item?.type || 'expense');
  const [accountId, setAccountId] = useState(String(item?.account_id ?? openAccounts[0]?.id ?? ''));
  const [targetAccountId, setTargetAccountId] = useState(String(item?.target_account_id ?? ''));
  const [amount, setAmount] = useState(item ? String(item.amount) : '');
  const [targetAmount, setTargetAmount] = useState(item?.target_amount ? String(item.target_amount) : '');
  const [payee, setPayee] = useState(item?.payee || '');
  const [categoryId, setCategoryId] = useState(item?.category_id ? String(item.category_id) : '');
  const [paymentType, setPaymentType] = useState(String(item?.payment_type ?? 0));
  const [memo, setMemo] = useState(item?.memo || '');
  const [every, setEvery] = useState(String(item?.every ?? 1));
  const [unit, setUnit] = useState<ScheduleUnit>(item?.unit || 'month');
  const [nextDate, setNextDate] = useState(item?.next_date || toISO(new Date()));
  const [endDate, setEndDate] = useState(item?.end_date || '');
  const [isScheduled, setIsScheduled] = useState<boolean>(item ? !!item.is_scheduled : defaultScheduled);
  const [name, setName] = useState(item?.name || '');
  const [tags, setTags] = useState(item?.tags || '');
  const [localError, setLocalError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const out: { id: number; name: string }[] = [];
    [...categories].sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
      out.push({ id: c.id, name: c.name });
      [...(c.children || [])].sort((a, b) => a.name.localeCompare(b.name)).forEach(ch => out.push({ id: ch.id, name: `${c.name}: ${ch.name}` }));
    });
    return out;
  }, [categories]);

  const source = accounts.find(a => String(a.id) === accountId);
  const target = accounts.find(a => String(a.id) === targetAccountId);
  const mixedCurrency = type === 'transfer' && source && target && source.currency !== target.currency;

  // Suggest the payee's default category, like the transaction form
  const onPayeeChange = (value: string) => {
    setPayee(value);
    const match = payees.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
    if (match?.default_category_id && !categoryId) setCategoryId(String(match.default_category_id));
    if (match?.default_payment_type != null && paymentType === '0') setPaymentType(String(match.default_payment_type));
  };

  const submit = () => {
    const amt = parseFloat(amount.replace(/\s/g, '').replace(',', '.'));
    const tAmt = targetAmount ? parseFloat(targetAmount.replace(/\s/g, '').replace(',', '.')) : null;
    const ev = parseInt(every, 10);
    if (!accountId) return setLocalError('Choose an account');
    // A template may keep amount 0 (filled in when used); a scheduled item needs a real amount
    if (!Number.isFinite(amt) || amt < 0 || (isScheduled && amt === 0)) {
      return setLocalError(isScheduled ? 'Amount must be greater than 0' : 'Amount must be 0 or more');
    }
    if (type === 'transfer' && !targetAccountId) return setLocalError('Choose the target account');
    if (type === 'transfer' && targetAccountId === accountId) return setLocalError('Source and target accounts must differ');
    if (tAmt !== null && (!Number.isFinite(tAmt) || tAmt <= 0)) return setLocalError('Target amount must be greater than 0');
    if (isScheduled) {
      if (!Number.isInteger(ev) || ev < 1 || ev > 366) return setLocalError('Repeat interval must be between 1 and 366');
      if (!nextDate) return setLocalError('Choose the next date');
      if (endDate && endDate < nextDate) return setLocalError('End date cannot be before the next date');
    }
    setLocalError(null);
    onSave({
      type,
      accountId: Number(accountId),
      targetAccountId: type === 'transfer' ? Number(targetAccountId) : null,
      amount: amt,
      targetAmount: type === 'transfer' && mixedCurrency ? tAmt : null,
      payee: type === 'transfer' ? '' : payee.trim(),
      categoryId: type === 'transfer' || !categoryId ? null : Number(categoryId),
      paymentType: Number(paymentType) || 0,
      memo: memo.trim(),
      every: Number.isInteger(ev) && ev >= 1 && ev <= 366 ? ev : 1,
      unit,
      nextDate: nextDate || toISO(new Date()),
      endDate: isScheduled ? endDate || null : null,
      isScheduled,
      name: name.trim(),
      tags,
    });
  };

  const field = 'w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'block text-[13px] font-medium text-slate-500 mb-1';

  return (
    <section className="p-6 md:p-8 bg-slate-900 border border-indigo-500/30 rounded-[2rem] space-y-5">
      <h3 className="text-[15px] font-semibold text-slate-100">
        {item ? 'Edit' : 'New'} {isScheduled ? 'scheduled transaction' : 'template'}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label>
          <span className={label}>Name (optional)</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={200} className={field} placeholder="e.g. Netflix, Fuel" />
        </label>
        <label className="flex items-center gap-3 self-end h-[46px] px-4 bg-slate-950/50 border border-slate-800 rounded-xl cursor-pointer select-none">
          <input type="checkbox" checked={isScheduled} onChange={e => setIsScheduled(e.target.checked)} className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-indigo-600" />
          <span className="text-xs font-bold text-slate-300">Repeat on a schedule</span>
        </label>
      </div>
      <div className="flex gap-2" role="radiogroup" aria-label="Type">
        {(['expense', 'income', 'transfer'] as const).map(t => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest ${type === t ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label>
          <span className={label}>{type === 'transfer' ? 'From account' : 'Account'}</span>
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={field}>
            {openAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </label>
        {type === 'transfer' ? (
          <label>
            <span className={label}>To account</span>
            <select value={targetAccountId} onChange={e => setTargetAccountId(e.target.value)} className={field}>
              <option value="">Choose…</option>
              {openAccounts.filter(a => String(a.id) !== accountId).map(a => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
            </select>
          </label>
        ) : (
          <label>
            <span className={label}>Payee</span>
            <input list="scheduled-payees" value={payee} onChange={e => onPayeeChange(e.target.value)} className={field} placeholder="e.g. Landlord" />
            <datalist id="scheduled-payees">
              {payees.map(p => <option key={p.id} value={p.name} />)}
            </datalist>
          </label>
        )}
        <label>
          <span className={label}>Amount{source ? ` (${source.currency})` : ''}</span>
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={field} placeholder="0.00" />
        </label>
        {mixedCurrency && (
          <label>
            <span className={label}>Amount received ({target?.currency})</span>
            <input inputMode="decimal" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className={field} placeholder="Same as amount" />
          </label>
        )}
        {type !== 'transfer' && (
          <label>
            <span className={label}>Category</span>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={field}>
              <option value="">Unassigned</option>
              {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {type !== 'transfer' && (
          <label>
            <span className={label}>Payment</span>
            <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className={field}>
              {PAYMENT_OPTIONS.filter(p => p.id !== 4).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label className={type === 'transfer' && !mixedCurrency ? 'md:col-span-2' : ''}>
          <span className={label}>Memo</span>
          <input value={memo} onChange={e => setMemo(e.target.value)} className={field} />
        </label>
        <label>
          <span className={label}>Tags</span>
          <input value={tags} onChange={e => setTags(e.target.value)} className={field} placeholder="e.g. subscription" />
        </label>
      </div>
      {isScheduled && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <label>
          <span className={label}>Repeat every</span>
          <input type="number" min={1} max={366} value={every} onChange={e => setEvery(e.target.value)} className={field} />
        </label>
        <label>
          <span className={label}>Unit</span>
          <select value={unit} onChange={e => setUnit(e.target.value as ScheduleUnit)} className={field}>
            <option value="day">Day(s)</option>
            <option value="week">Week(s)</option>
            <option value="month">Month(s)</option>
            <option value="year">Year(s)</option>
          </select>
        </label>
        <label>
          <span className={label}>Next date</span>
          <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className={field} />
        </label>
        <label>
          <span className={label}>End date (optional)</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={field} />
        </label>
      </div>
      )}
      {localError && <p className="text-xs font-bold text-rose-400">{localError}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={isSaving} className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-40 hover:text-white">
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest">
          Cancel
        </button>
      </div>
    </section>
  );
};

/**
 * "Post all due" with a confirmation that shows how many transactions will be created
 * (an old next date can mean many missed occurrences).
 */
export const PostAllDueButton: React.FC<{ scheduled: UseScheduledResult; dueCount: number }> = ({ scheduled, dueCount }) => {
  const [pending, setPending] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    try {
      setChecking(true);
      setError(null);
      const { wouldPost } = await scheduledService.countDue(toISO(new Date()));
      setPending(wouldPost);
    } catch {
      setError('Could not check due transactions');
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <button
        onClick={ask}
        disabled={scheduled.isSaving || checking}
        className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/25 disabled:opacity-40"
      >
        Post all due ({dueCount})
      </button>
      {error && <span role="alert" className="text-xs font-bold text-rose-400">{error}</span>}
      <ConfirmModal
        isOpen={pending !== null}
        title="Post all due transactions?"
        message={
          <>
            This will add <span className="text-slate-100 font-bold">{pending}</span> transaction(s) to the ledger
            {pending !== null && pending > dueCount * 3 ? ' – some schedules have many missed dates. Consider Skip or editing the next date instead.' : '.'}
          </>
        }
        confirmLabel={`Post ${pending ?? ''}`}
        variant={pending !== null && pending > dueCount * 3 ? 'danger' : 'primary'}
        onConfirm={async () => {
          await scheduled.postDue();
          setPending(null);
        }}
        onCancel={() => setPending(null)}
        isLoading={scheduled.isSaving}
      />
    </>
  );
};
