import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Account, Transaction } from '../../types';
import { PERIODS, PeriodId, periodRange, formatMoney, toISO } from '../../utils/periodUtils';
import { parseDateForComparison } from '../../utils/dateUtils';
import { CurrencyRates, isInSummary, toBase } from '../../utils/currencyUtils';

/**
 * Balance over time, like HomeBank's "Balance" report.
 * Shows one account in its own currency, or all summary accounts converted to the base currency.
 * Transfers between accounts that are both included cancel out on their own.
 */

interface BalanceReportProps {
  accounts: Account[];
  transactions: Transaction[];
  isAnonymized: boolean;
  rates: CurrencyRates;
}

type RangeId = PeriodId | 'all';

const LINE_COLOR = '#3987e5';
const DAY_MS = 86400000;
const MAX_DAILY_POINTS = 400; // longer ranges switch to month-end points

interface Point { date: string; value: number }

export const BalanceReport: React.FC<BalanceReportProps> = ({ accounts, transactions, isAnonymized, rates }) => {
  const [range, setRange] = useState<RangeId>('last_12');
  const [accountId, setAccountId] = useState('all');
  const fmt = (v: number) => formatMoney(v, isAnonymized);

  const selected = accountId === 'all' ? null : accounts.find(a => String(a.id) === accountId) || null;
  const included = useMemo(
    () => (selected ? [selected] : accounts.filter(isInSummary)),
    [selected, accounts]
  );
  // A single account is shown in its own currency; "all" needs a base currency
  const currency = selected ? selected.currency : rates.base;
  const convert = (amount: number, cur: string) => (selected ? amount : toBase(amount, cur, rates));

  const result = useMemo(() => {
    if (!currency) return null;
    const accById = new Map<number, Account>(included.map(a => [a.id, a]));
    const missing = new Set<string>();
    const conv = (amount: number, cur: string) => {
      const v = convert(amount, cur);
      if (v === null) missing.add(cur);
      return v ?? 0;
    };

    const txs = transactions
      .filter(t => accById.has(t.account_id))
      .map(t => ({ iso: parseDateForComparison(t.date), amount: conv(t.amount || 0, accById.get(t.account_id)!.currency) }))
      .sort((a, b) => a.iso.localeCompare(b.iso));

    const today = toISO(new Date());
    const span = range === 'all'
      ? { from: txs[0]?.iso || today, to: today }
      : periodRange(range);
    // Never draw into the future beyond today unless the range itself ends later
    const to = span.to;
    const from = span.from;

    let balance = included.reduce((s, a) => s + conv(a.initial_balance || 0, a.currency), 0);
    let i = 0;
    while (i < txs.length && txs[i].iso < from) balance += txs[i++].amount;

    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
    const monthly = days > MAX_DAILY_POINTS;
    const points: Point[] = [];
    const cursor = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    while (cursor <= end) {
      let stepEnd: Date;
      if (monthly) {
        stepEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
        if (stepEnd > end) stepEnd = end;
      } else {
        stepEnd = cursor;
      }
      const stepISO = stepEnd.toISOString().slice(0, 10);
      while (i < txs.length && txs[i].iso <= stepISO) balance += txs[i++].amount;
      points.push({ date: stepISO, value: Math.round(balance * 100) / 100 });
      cursor.setTime(stepEnd.getTime() + DAY_MS);
    }
    return { points, monthly, missing: Array.from(missing) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [included, transactions, range, currency, rates, selected]);

  const values = result?.points.map(p => p.value) || [];
  const stats = values.length
    ? {
        start: values[0],
        end: values[values.length - 1],
        min: Math.min(...values),
        max: Math.max(...values),
      }
    : null;

  const selectClass = 'bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-indigo-500';
  const labelClass = 'flex flex-col gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500';

  return (
    <div className="space-y-8">
      <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-[2rem] flex flex-wrap items-end gap-4">
        <label className={labelClass}>
          Account
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={selectClass}>
            <option value="all">All accounts (summary){rates.base ? ` · ${rates.base}` : ''}</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.currency}){a.closed ? ' – closed' : ''}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Period
          <select value={range} onChange={e => setRange(e.target.value as RangeId)} className={selectClass}>
            {PERIODS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value="all">All time</option>
          </select>
        </label>
      </div>

      {!currency ? (
        <p className="text-sm text-slate-400 p-6 bg-slate-900/40 border border-slate-800 rounded-[2rem]">
          To chart all accounts together, set a base currency in Options → Exchange rates, or pick a single account.
        </p>
      ) : result && stats ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Tile label="At start" value={`${fmt(stats.start)} ${currency}`} />
            <Tile label="At end" value={`${fmt(stats.end)} ${currency}`} />
            <Tile label="Change" value={`${stats.end - stats.start >= 0 ? '+' : '−'}${fmt(Math.abs(stats.end - stats.start))} ${currency}`} />
            <Tile label="Lowest" value={`${fmt(stats.min)} ${currency}`} />
          </div>
          <section className="p-4 md:p-8 bg-slate-900/40 border border-slate-800 rounded-[2rem] space-y-3">
            <header>
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">
                Balance · {selected ? selected.name : 'all summary accounts'}
              </h2>
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                {result.monthly ? 'Month-end balances' : 'Daily balances'} · {currency}
                {!selected && ' · converted with the current exchange rates'}
                {result.missing.length > 0 && ` · without rate: ${result.missing.join(', ')}`}
              </p>
            </header>
            <LineChart points={result.points} fmt={fmt} currency={currency} monthly={result.monthly} />
          </section>
        </>
      ) : null}
    </div>
  );
};

const Tile: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-5 bg-slate-900/40 border border-slate-800 rounded-[2rem]">
    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
    <div className="mt-2 text-lg font-black text-slate-100 tabular-nums">{value}</div>
  </div>
);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string, monthly: boolean) => {
  const [y, m, d] = iso.split('-');
  return monthly ? `${MONTHS[Number(m) - 1]} ${y}` : `${Number(d)} ${MONTHS[Number(m) - 1]}`;
};

/** Single-series line (2px), recessive grid, zero line when crossed, crosshair + tooltip on hover/touch. */
const LineChart: React.FC<{ points: Point[]; fmt: (v: number) => string; currency: string; monthly: boolean }> = ({ points, fmt, currency, monthly }) => {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Narrow screens get a smaller drawing so text stays readable when scaled to the width
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const W = narrow ? 360 : 720;
  const H = narrow ? 240 : 280;
  const M = { top: 16, right: 12, bottom: 28, left: narrow ? 52 : 64 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  const values = points.map(p => p.value);
  const dataMin = Math.min(...values);
  let min = dataMin;
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08;
  // Don't invent a negative axis for balances that never went below zero
  min = dataMin >= 0 ? Math.max(0, min - pad) : min - pad;
  max += pad;
  // Axis labels without decimals; values in the tooltip keep them
  const axisFmt = (v: number) => fmt(Math.round(v)).replace(/[.,]00$/, '');

  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => M.top + (1 - (v - min) / (max - min)) * plotH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => min + (max - min) * f);
  const labelEvery = Math.max(1, Math.ceil(points.length / (narrow ? 3 : 6)));
  // Regular labels too close to the last one are dropped so they don't overlap
  const showLabel = (i: number) =>
    i === points.length - 1 || (i % labelEvery === 0 && points.length - 1 - i >= labelEvery * 0.6);

  const pick = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - M.left) / plotW) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-none"
        role="img"
        aria-label={`Balance over time in ${currency}`}
        onMouseMove={e => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={e => pick(e.touches[0].clientX)}
        onTouchMove={e => pick(e.touches[0].clientX)}
      >
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#1e293b" strokeWidth={1} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#94a3b8">{axisFmt(t)}</text>
          </g>
        ))}
        {min < 0 && max > 0 && (
          <line x1={M.left} x2={W - M.right} y1={y(0)} y2={y(0)} stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" />
        )}
        <path d={path} fill="none" stroke={LINE_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => showLabel(i) && (
          <text
            key={p.date}
            x={x(i)}
            y={H - 8}
            textAnchor={i === points.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}
            fontSize={11}
            fill="#94a3b8"
          >
            {shortDate(p.date, monthly)}
          </text>
        ))}
        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + plotH} stroke="#64748b" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(hp.value)} r={5} fill={LINE_COLOR} stroke="#0b1120" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && hover !== null && (
        <div
          className="absolute top-2 pointer-events-none px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 shadow-xl text-[11px] font-bold text-slate-200 whitespace-nowrap"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover < points.length / 2 ? '8px' : 'calc(-100% - 8px)'})` }}
        >
          <div className="text-slate-400">{hp.date}</div>
          <div>{fmt(hp.value)} {currency}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>Balance over time ({currency})</caption>
        <thead><tr><th>Date</th><th>Balance</th></tr></thead>
        <tbody>{points.map(p => <tr key={p.date}><td>{p.date}</td><td>{fmt(p.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
};
