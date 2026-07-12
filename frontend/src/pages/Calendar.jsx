import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, ArrowLeftRight, Scale, Receipt, CalendarDays,
} from 'lucide-react';
import { Button, Card, KpiCard, Chip, Modal, EmptyState, DynamicIcon } from '../components/ui/index.js';
import { transactionsApi, categoriesApi, accountsApi, formatCurrency } from '../lib/api.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPE_META = {
  income: { label: 'Income', tone: 'success' },
  expense: { label: 'Expense', tone: 'danger' },
  transfer: { label: 'Transfer', tone: 'info' },
};

export function pad2(n) {
  return String(n).padStart(2, '0');
}
export function dateKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function startOfWeek(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - r.getDay());
  return r;
}
export function buildMonthGrid(focusDate) {
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = addDays(firstOfMonth, -startOffset);
  const daysInMonthCount = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonthCount) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const d = addDays(gridStart, i);
    return { date: d, key: dateKey(d), inMonth: d.getMonth() === month };
  });
}
export function buildWeekGrid(focusDate) {
  const start = startOfWeek(focusDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { date: d, key: dateKey(d) };
  });
}
export function weekLabel(weekCells) {
  const start = weekCells[0].date;
  const end = weekCells[6].date;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = sameMonth
    ? `${end.getDate()}, ${end.getFullYear()}`
    : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} – ${endStr}`;
}
export function summarize(list) {
  let income = 0, expense = 0, transfer = 0;
  list.forEach((t) => {
    if (t.type === 'income') income += t.amount;
    else if (t.type === 'expense') expense += Math.abs(t.amount);
    else transfer += Math.abs(t.amount);
  });
  return { income, expense, transfer, net: income - expense, count: list.length };
}
function resolveCategory(categories, categoryId) {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return { category: 'Uncategorized', subcategory: null, color: '#64748b', icon: 'Circle' };
  if (cat.parentId) {
    const parent = categories.find((c) => c.id === cat.parentId);
    return { category: parent?.name || cat.name, subcategory: cat.name, color: cat.color, icon: cat.icon };
  }
  return { category: cat.name, subcategory: null, color: cat.color, icon: cat.icon };
}
function accMeta(accounts, id) {
  return accounts.find((a) => a.id === id) || null;
}

function DayStatBar({ summary }) {
  const items = [
    { label: 'Income', value: summary.income, tone: 'text-emerald-500' },
    { label: 'Expense', value: summary.expense, tone: 'text-rose-500' },
    { label: 'Transfers', value: summary.transfer, tone: 'text-cyan-500' },
    { label: 'Net', value: summary.net, tone: summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{it.label}</p>
          <p className={`mt-0.5 font-display text-sm font-bold tabular-nums ${it.tone}`}>{formatCurrency(it.value)}</p>
        </div>
      ))}
    </div>
  );
}

function TransactionRow({ t, categories, accounts }) {
  const { category, subcategory, color, icon } = resolveCategory(categories, t.categoryId);
  const meta = TYPE_META[t.type] || TYPE_META.expense;
  const isTransfer = t.type === 'transfer';
  const from = accMeta(accounts, t.fromAccountId);
  const to = accMeta(accounts, t.toAccountId);
  const acc = accMeta(accounts, t.accountId);
  const accountLabel = isTransfer ? `${from?.name || '—'} → ${to?.name || '—'}` : acc?.name || '—';
  const sign = t.type === 'expense' ? '-' : t.type === 'income' ? '+' : '';
  const amountTone = t.type === 'expense' ? 'text-rose-500' : t.type === 'income' ? 'text-emerald-500' : 'text-cyan-500';

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 transition hover:border-line-strong hover:shadow-card sm:p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ color, background: `${color}15` }}>
        <DynamicIcon name={icon} size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate font-display text-sm font-semibold text-fg">{t.vendor || category}</p>
          <p className={`shrink-0 font-display text-sm font-bold tabular-nums ${amountTone}`}>{sign}{formatCurrency(Math.abs(t.amount))}</p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip tone={meta.tone}>{meta.label}</Chip>
          <span
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
            style={{ color, borderColor: `${color}40`, background: `${color}15` }}
          >
            <DynamicIcon name={icon} size={11} /> {category}
          </span>
          {subcategory && <span className="text-[11px] text-subtle">› {subcategory}</span>}
          <span className="text-[11px] text-muted">{accountLabel}</span>
        </div>
        {t.note && <p className="mt-1.5 text-xs italic text-subtle">"{t.note}"</p>}
      </div>
    </div>
  );
}

function Timeline({ txns, categories, accounts }) {
  return (
    <div className="relative pl-6">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-line" />
      <div className="space-y-3">
        {txns.map((t) => {
          const dotTone = t.type === 'expense' ? 'bg-rose-500' : t.type === 'income' ? 'bg-emerald-500' : 'bg-cyan-500';
          return (
            <div key={t.id} className="relative">
              <span className={`absolute -left-6 top-4 h-3 w-3 rounded-full border-2 border-surface ${dotTone}`} />
              <TransactionRow t={t} categories={categories} accounts={accounts} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState('month');
  const [focusDate, setFocusDate] = useState(() => new Date());
  const [dayModalOpen, setDayModalOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayKey = dateKey(today);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const touchRef = useRef({ x: 0, active: false });

  async function load() {
    setLoadError('');
    try {
      const [txns, cats, accs] = await Promise.all([transactionsApi.list(), categoriesApi.list(), accountsApi.list()]);
      setTransactions(txns || []);
      setCategories(cats || []);
      setAccounts(accs || []);
    } catch (err) {
      setLoadError(err.message || 'Could not load your calendar.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useTxCreatedListener(load);

  const txnsByDate = useMemo(() => {
    const map = new Map();
    transactions.forEach((t) => {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date).push(t);
    });
    return map;
  }, [transactions]);

  const monthPrefix = `${focusDate.getFullYear()}-${pad2(focusDate.getMonth() + 1)}`;
  const monthSummary = useMemo(
    () => summarize(transactions.filter((t) => t.date.startsWith(monthPrefix))),
    [transactions, monthPrefix]
  );

  const monthCells = useMemo(() => buildMonthGrid(focusDate), [focusDate]);
  const weekCells = useMemo(() => buildWeekGrid(focusDate), [focusDate]);

  const focusKey = dateKey(focusDate);
  const focusTxns = useMemo(() => [...(txnsByDate.get(focusKey) || [])].reverse(), [txnsByDate, focusKey]);
  const focusSummary = useMemo(() => summarize(focusTxns), [focusTxns]);

  const selectedTxns = useMemo(() => [...(txnsByDate.get(selectedDate) || [])].reverse(), [txnsByDate, selectedDate]);
  const selectedSummary = useMemo(() => summarize(selectedTxns), [selectedTxns]);
  const selectedDateObj = useMemo(() => keyToDate(selectedDate), [selectedDate]);

  function goPrev() {
    if (view === 'month') setFocusDate((d) => addMonths(d, -1));
    else if (view === 'week') setFocusDate((d) => addDays(d, -7));
    else setFocusDate((d) => addDays(d, -1));
  }
  function goNext() {
    if (view === 'month') setFocusDate((d) => addMonths(d, 1));
    else if (view === 'week') setFocusDate((d) => addDays(d, 7));
    else setFocusDate((d) => addDays(d, 1));
  }
  function goToday() {
    setFocusDate(new Date());
    setSelectedDate(todayKey);
  }
  function selectDate(date) {
    const key = dateKey(date);
    setSelectedDate(key);
    if (date.getMonth() !== focusDate.getMonth() || date.getFullYear() !== focusDate.getFullYear()) {
      setFocusDate(new Date(date.getFullYear(), date.getMonth(), 1));
    }
    if (view !== 'day') setDayModalOpen(true);
  }
  function openFullDay(key) {
    setFocusDate(keyToDate(key));
    setView('day');
    setDayModalOpen(false);
  }

  function onTouchStart(e) {
    touchRef.current = { x: e.touches[0].clientX, active: true };
  }
  function onTouchEnd(e) {
    if (!touchRef.current.active) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    touchRef.current.active = false;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  if (loading) return <p className="text-sm text-muted">Loading calendar…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your calendar"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }

  const headerLabel =
    view === 'month'
      ? focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : view === 'week'
      ? weekLabel(weekCells)
      : focusDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">Monthly summary</h2>
            <p className="text-sm text-muted">{focusDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} at a glance.</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted">
            <Receipt size={13} /> {monthSummary.count} transaction{monthSummary.count === 1 ? '' : 's'}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Income" value={formatCurrency(monthSummary.income)} tone="lime" icon={<TrendingUp size={18} />} />
          <KpiCard label="Expenses" value={formatCurrency(monthSummary.expense)} tone="rose" icon={<TrendingDown size={18} />} />
          <KpiCard label="Transfers" value={formatCurrency(monthSummary.transfer)} tone="cyan" icon={<ArrowLeftRight size={18} />} />
          <KpiCard label="Net savings" value={formatCurrency(monthSummary.net)} tone="brand" icon={<Scale size={18} />} />
        </div>
      </div>

      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button" onClick={goPrev}
              className="rounded-xl border border-line p-2 text-muted transition hover:border-line-strong hover:bg-tint/[0.04] hover:text-fg"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="min-w-[150px] text-center font-display text-base font-semibold text-fg sm:min-w-[220px] sm:text-lg">{headerLabel}</p>
            <button
              type="button" onClick={goNext}
              className="rounded-xl border border-line p-2 text-muted transition hover:border-line-strong hover:bg-tint/[0.04] hover:text-fg"
            >
              <ChevronRight size={16} />
            </button>
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          </div>
          <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
            {['month', 'week', 'day'].map((v) => (
              <button
                key={v} type="button" onClick={() => setView(v)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition ${
                  view === v ? 'bg-brand-500 text-white shadow-glow' : 'text-muted hover:text-fg'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-subtle">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Income</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Expense</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Transfer</span>
        </div>

        <div className="mt-4" onTouchStart={view !== 'day' ? onTouchStart : undefined} onTouchEnd={view !== 'day' ? onTouchEnd : undefined}>
          {view === 'month' && (
            <div key={`month-${monthPrefix}`} className="animate-viewIn">
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-subtle sm:gap-2">
                {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
                {monthCells.map(({ date, key, inMonth }) => {
                  const list = txnsByDate.get(key) || [];
                  const summary = summarize(list);
                  const isToday = key === todayKey;
                  const isSelected = key === selectedDate;
                  const types = new Set(list.map((t) => t.type));
                  return (
                    <button
                      key={key} type="button" onClick={() => selectDate(date)}
                      className={`group relative flex aspect-square flex-col items-center rounded-2xl border p-1.5 text-left transition sm:p-2 ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500/10 shadow-glow'
                          : isToday
                          ? 'border-brand-400/50 bg-brand-500/5'
                          : 'border-line bg-surface hover:border-line-strong hover:shadow-card'
                      } ${inMonth ? '' : 'opacity-40'}`}
                    >
                      {list.length > 1 && (
                        <span className="absolute right-1 top-1 rounded-full bg-tint/10 px-1 text-[9px] font-bold text-subtle">{list.length}</span>
                      )}
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full font-display text-xs font-bold ${isToday ? 'bg-brand-500 text-white' : 'text-fg'}`}>
                        {date.getDate()}
                      </span>
                      {list.length > 0 && (
                        <>
                          <span className="mt-1 flex items-center gap-0.5">
                            {types.has('income') && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                            {types.has('expense') && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
                            {types.has('transfer') && <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />}
                          </span>
                          <span className={`mt-auto hidden font-display text-[10px] font-bold tabular-nums sm:block ${summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {formatCurrency(summary.net)}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div key={`week-${weekCells[0].key}`} className="animate-viewIn grid grid-cols-1 gap-3 sm:grid-cols-7">
              {weekCells.map(({ date, key }) => {
                const list = [...(txnsByDate.get(key) || [])].reverse();
                const summary = summarize(list);
                const isToday = key === todayKey;
                const isSelected = key === selectedDate;
                return (
                  <button
                    key={key} type="button" onClick={() => selectDate(date)}
                    className={`flex min-h-[200px] flex-col rounded-2xl border p-3 text-left transition ${
                      isSelected
                        ? 'border-brand-500 bg-brand-500/10 shadow-glow'
                        : isToday
                        ? 'border-brand-400/50 bg-brand-500/5'
                        : 'border-line bg-surface hover:border-line-strong hover:shadow-card'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-subtle">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className={`font-display text-lg font-bold ${isToday ? 'text-brand-500' : 'text-fg'}`}>{date.getDate()}</p>
                      </div>
                      {list.length > 0 && <span className="rounded-full bg-tint/10 px-1.5 py-0.5 text-[10px] font-bold text-subtle">{list.length}</span>}
                    </div>
                    <div className="mt-2 flex-1 space-y-1 overflow-hidden">
                      {list.slice(0, 4).map((t) => (
                        <div key={t.id} className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate text-muted">{t.vendor || '—'}</span>
                          <span className={`shrink-0 font-semibold tabular-nums ${t.type === 'expense' ? 'text-rose-500' : t.type === 'income' ? 'text-emerald-500' : 'text-cyan-500'}`}>
                            {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''}{formatCurrency(Math.abs(t.amount))}
                          </span>
                        </div>
                      ))}
                      {list.length > 4 && <p className="text-[10px] text-subtle">+{list.length - 4} more</p>}
                    </div>
                    {list.length > 0 && (
                      <p className={`mt-2 border-t border-line pt-2 text-right font-display text-xs font-bold tabular-nums ${summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {formatCurrency(summary.net)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'day' && (
            <div key={`day-${focusKey}`} className="animate-viewIn space-y-5">
              <DayStatBar summary={focusSummary} />
              {focusTxns.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays size={20} />} title="No transactions"
                  body={`Nothing recorded on ${focusDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}
                />
              ) : (
                <Timeline txns={focusTxns} categories={categories} accounts={accounts} />
              )}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={dayModalOpen} onClose={() => setDayModalOpen(false)} size="lg"
        title={selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        subtitle={`${selectedSummary.count} transaction${selectedSummary.count === 1 ? '' : 's'}`}
      >
        <DayStatBar summary={selectedSummary} />
        <div className="mt-5">
          {selectedTxns.length === 0 ? (
            <EmptyState icon={<CalendarDays size={20} />} title="No transactions" body="Nothing recorded on this day." />
          ) : (
            <Timeline txns={selectedTxns} categories={categories} accounts={accounts} />
          )}
        </div>
        <div className="mt-5 flex justify-end">
          <Button variant="outline" size="sm" onClick={() => openFullDay(selectedDate)}>Open full day view</Button>
        </div>
      </Modal>
    </div>
  );
}
