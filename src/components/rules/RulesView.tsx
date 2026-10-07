import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, Rule, RuleInput } from '../../types';
import { rulesService, ApiError } from '../../api';
import { Alert, ConfirmModal } from '../common';
import { PAYMENT_LEXICON, PAYMENT_OPTIONS } from '../../constants';
import { normalizeTags, splitTags } from '../../utils/tagUtils';

/**
 * Assignment rules, like HomeBank's "Manage assignment rules":
 * "if payee/memo contains X, set category / payment / tags".
 * Used as suggestions in the transaction form, automatically on CSV import,
 * and on demand for existing uncategorised transactions.
 */

interface RulesViewProps {
  rules: Rule[];
  categories: Category[];
  onChanged: () => Promise<void>;
  onTransactionsChanged: () => Promise<void>;
}

const FIELD_LABEL: Record<Rule['field'], string> = { payee: 'Payee', memo: 'Memo', any: 'Payee or memo' };

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? `API Error (${err.status}): ${err.message}` : fallback;

export const RulesView: React.FC<RulesViewProps> = ({ rules, categories, onChanged, onTransactionsChanged }) => {
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Rule | null>(null);
  const [applyPreview, setApplyPreview] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => { onChanged().catch(() => {}); }, [onChanged]);

  const busy = useCallback(async (action: () => Promise<void>, fallback: string) => {
    try {
      setIsBusy(true);
      setError(null);
      await action();
    } catch (err) {
      setError(errorText(err, fallback));
    } finally {
      setIsBusy(false);
    }
  }, []);

  const save = (data: RuleInput, id?: number) => busy(async () => {
    if (id) await rulesService.update(id, data);
    else await rulesService.create(data);
    await onChanged();
    setEditing(null);
  }, 'Failed to save rule');

  const remove = (rule: Rule) => busy(async () => {
    await rulesService.delete(rule.id);
    await onChanged();
    setConfirmDelete(null);
  }, 'Failed to delete rule');

  const previewApply = () => busy(async () => {
    setMessage(null);
    const result = await rulesService.apply(true);
    setApplyPreview(result.matched);
  }, 'Failed to check transactions');

  const runApply = () => busy(async () => {
    const result = await rulesService.apply(false);
    setApplyPreview(null);
    setMessage(`${result.updated} transaction(s) updated.`);
    await onTransactionsChanged();
  }, 'Failed to apply rules');

  const categoryName = (r: Rule) =>
    r.category_name ? (r.parent_category_name ? `${r.parent_category_name}: ${r.category_name}` : r.category_name) : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 space-y-8 max-w-5xl mx-auto">
      {error && <Alert variant="error" message={error} />}
      {message && <Alert variant="info" message={message} />}

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Assignment rules</h1>
          <p className="text-[10px] font-bold text-slate-500 mt-1">
            Automatically fill category, payment and tags. Used in the entry form, on CSV import, and on demand below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          {rules.length > 0 && (
            <button
              onClick={previewApply}
              disabled={isBusy}
              className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:text-slate-100 disabled:opacity-40"
            >
              Apply to uncategorised…
            </button>
          )}
          <button
            onClick={() => setEditing('new')}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white"
          >
            + Add rule
          </button>
        </div>
      </div>

      {editing && (
        <RuleForm
          rule={editing === 'new' ? null : editing}
          categories={categories}
          isSaving={isBusy}
          nextPosition={rules.length ? Math.max(...rules.map(r => r.position)) + 1 : 0}
          onCancel={() => setEditing(null)}
          onSave={data => save(data, editing === 'new' ? undefined : editing.id)}
        />
      )}

      <section className="p-4 md:p-8 bg-slate-900 border border-slate-800 rounded-[2rem]">
        {rules.length === 0 ? (
          <p className="text-sm text-slate-500 py-10 text-center">
            No rules yet. Example: payee contains “biedronka” → Food: Groceries, tag “shop”.
          </p>
        ) : (
          <ol className="divide-y divide-slate-800/60">
            {rules.map((r, i) => (
              <li key={r.id} className="py-4 px-2 flex flex-col md:flex-row md:items-center gap-3">
                <span className="text-[10px] font-black text-slate-600 w-6" title="Order: the first matching rule wins">{i + 1}.</span>
                <div className="flex-1 min-w-0 text-sm text-slate-300">
                  <span className="text-slate-500">If </span>
                  <span className="font-bold">{FIELD_LABEL[r.field].toLowerCase()}</span>
                  <span className="text-slate-500"> {r.match_type === 'exact' ? 'is' : 'contains'} </span>
                  <span className="font-black text-slate-100">“{r.pattern}”</span>
                  <span className="text-slate-500"> → </span>
                  {categoryName(r) && <span className="font-bold text-slate-100">{categoryName(r)}</span>}
                  {r.payment_type ? <span className="text-slate-400"> · {PAYMENT_LEXICON[r.payment_type]?.name}</span> : null}
                  {splitTags(r.tags).map(tag => (
                    <span key={tag} className="ml-1.5 px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-300">#{tag}</span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(r)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white">Edit</button>
                  <button onClick={() => setConfirmDelete(r)} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest hover:bg-rose-600 hover:text-white">Delete</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmModal
        isOpen={!!confirmDelete}
        title="Delete rule?"
        message={<>The rule for <span className="text-slate-100 font-bold">“{confirmDelete?.pattern}”</span> will be removed. Transactions it already changed stay as they are.</>}
        confirmLabel="Delete"
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
        isLoading={isBusy}
      />

      <ConfirmModal
        isOpen={applyPreview !== null}
        title="Apply rules to existing transactions?"
        message={applyPreview
          ? <>{applyPreview} transaction(s) without a category match a rule and will get its category, payment type and tags. Transactions that already have a category are not touched.</>
          : <>No uncategorised transactions match your rules.</>}
        confirmLabel={applyPreview ? `Update ${applyPreview}` : 'OK'}
        variant="primary"
        onConfirm={() => (applyPreview ? runApply() : setApplyPreview(null))}
        onCancel={() => setApplyPreview(null)}
        isLoading={isBusy}
      />
    </div>
  );
};

const RuleForm: React.FC<{
  rule: Rule | null;
  categories: Category[];
  isSaving: boolean;
  nextPosition: number;
  onCancel: () => void;
  onSave: (data: RuleInput) => void;
}> = ({ rule, categories, isSaving, nextPosition, onCancel, onSave }) => {
  const [field, setField] = useState<Rule['field']>(rule?.field || 'payee');
  const [matchType, setMatchType] = useState<Rule['match_type']>(rule?.match_type || 'contains');
  const [pattern, setPattern] = useState(rule?.pattern || '');
  const [categoryId, setCategoryId] = useState(rule?.category_id ? String(rule.category_id) : '');
  const [paymentType, setPaymentType] = useState(rule?.payment_type ? String(rule.payment_type) : '');
  const [tags, setTags] = useState(rule?.tags || '');
  const [position, setPosition] = useState(String(rule?.position ?? nextPosition));
  const [localError, setLocalError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const out: { id: number; name: string }[] = [];
    [...categories].sort((a, b) => a.name.localeCompare(b.name)).forEach(c => {
      out.push({ id: c.id, name: c.name });
      [...(c.children || [])].sort((a, b) => a.name.localeCompare(b.name)).forEach(ch => out.push({ id: ch.id, name: `${c.name}: ${ch.name}` }));
    });
    return out;
  }, [categories]);

  const submit = () => {
    const cleanTags = normalizeTags(tags);
    const pos = parseInt(position, 10);
    if (!pattern.trim()) return setLocalError('Enter the text to look for');
    if (!categoryId && !paymentType && !cleanTags) return setLocalError('Choose a category, payment type or tags to assign');
    if (!Number.isInteger(pos) || pos < 0) return setLocalError('Order must be 0 or more');
    setLocalError(null);
    onSave({
      field,
      matchType,
      pattern: pattern.trim(),
      categoryId: categoryId ? Number(categoryId) : null,
      paymentType: paymentType ? Number(paymentType) : null,
      tags: cleanTags,
      position: pos,
    });
  };

  const input = 'w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500';
  const label = 'block text-[13px] font-medium text-slate-500 mb-1';

  return (
    <section className="p-6 md:p-8 bg-slate-900 border border-indigo-500/30 rounded-[2rem] space-y-5">
      <h3 className="text-[15px] font-semibold text-slate-100">{rule ? 'Edit rule' : 'New rule'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label>
          <span className={label}>When</span>
          <select value={field} onChange={e => setField(e.target.value as Rule['field'])} className={input}>
            <option value="payee">Payee</option>
            <option value="memo">Memo</option>
            <option value="any">Payee or memo</option>
          </select>
        </label>
        <label>
          <span className={label}>Match</span>
          <select value={matchType} onChange={e => setMatchType(e.target.value as Rule['match_type'])} className={input}>
            <option value="contains">contains</option>
            <option value="exact">is exactly</option>
          </select>
        </label>
        <label>
          <span className={label}>Text (not case-sensitive)</span>
          <input value={pattern} onChange={e => setPattern(e.target.value)} maxLength={200} className={input} placeholder="e.g. biedronka" />
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label>
          <span className={label}>Set category</span>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={input}>
            <option value="">— don’t change —</option>
            {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>
          <span className={label}>Set payment</span>
          <select value={paymentType} onChange={e => setPaymentType(e.target.value)} className={input}>
            <option value="">— don’t change —</option>
            {PAYMENT_OPTIONS.filter(p => p.id !== 0 && p.id !== 4).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>
          <span className={label}>Add tags</span>
          <input value={tags} onChange={e => setTags(e.target.value)} onBlur={() => setTags(normalizeTags(tags))} className={input} placeholder="e.g. shop daily" />
        </label>
        <label>
          <span className={label}>Order (lower first)</span>
          <input type="number" min={0} value={position} onChange={e => setPosition(e.target.value)} className={input} />
        </label>
      </div>
      {localError && <p className="text-xs font-bold text-rose-400">{localError}</p>}
      <div className="flex gap-3">
        <button onClick={submit} disabled={isSaving} className="px-6 py-3 rounded-xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 disabled:opacity-40 hover:text-white">
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-6 py-3 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest">Cancel</button>
      </div>
    </section>
  );
};
