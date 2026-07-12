import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart, Activity, PieChart as PieChartIcon, CalendarDays, Target, ArrowLeftRight,
  Sparkles, Store, PiggyBank, ShieldCheck, ArrowRight, Info,
} from 'lucide-react';
import {
  AreaChart, Area, PieChart, Pie, Cell, LineChart as RLineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';
import { Chip, ProgressBar, DynamicIcon, EmptyState } from '../../components/ui/index.js';
import { ChartTip, CategoryTip } from '../../components/ui/ChartTooltip.jsx';
import { CATEGORY_COLORS } from '../../lib/categoryIcons.js';
import { formatCurrency, formatDate, reportsApi } from '../../lib/api.js';
import { AI_WIDGET_REGISTRY } from './aiWidgets.jsx';

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function catMeta(categories, id) {
  return categories.find((c) => c.id === id) || { name: 'Uncategorized', color: '#64748b', icon: 'Circle' };
}

// Two categories can legitimately share the same stored color (nothing
// stops a user picking the same swatch for both). That's fine everywhere
// colors are shown next to a label, but in a chart with no labels on the
// slices themselves, two same-colored wedges become indistinguishable — so
// reassign the repeat to the next unused color from the shared palette.
function dedupeChartColors(items) {
  const used = new Set();
  return items.map((item) => {
    let color = item.color;
    if (used.has(color)) {
      color = CATEGORY_COLORS.find((c) => !used.has(c)) || color;
    }
    used.add(color);
    return { ...item, color };
  });
}
function accMeta(accounts, id) {
  return accounts.find((a) => a.id === id) || null;
}

// ---------------------------------------------------------------------------
const TAG_TREND_SERIES = [
  { key: 'expenditure', name: 'Expenditure', color: '#f43f5e' },
  { key: 'protection', name: 'Protection', color: '#06b6d4' },
  { key: 'income', name: 'Income', color: '#22c55e' },
  { key: 'investment', name: 'Investment', color: '#f59e0b' },
];

// Clicking a legend entry isolates that line (hides the rest) — click it
// again, or a different entry, to change focus; click the same entry a
// second time to return to showing all four. Recharts' own <Legend> just
// labels the chart by default, so the isolate-on-click behavior is wired up
// by hand here via the `hidden` set and a custom legend renderer.
function CashFlowLegend({ series, hidden, onToggle }) {
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {series.map((s) => {
        const isHidden = hidden.has(s.key);
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onToggle(s.key)}
            className={`flex items-center gap-1.5 text-xs font-medium transition ${isHidden ? 'text-subtle opacity-50' : 'text-muted'}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

export function CashFlowWidget({ data }) {
  const trend = data.spendingTrend || [];
  const [isolated, setIsolated] = useState(null);
  const hasData = trend.some((t) => TAG_TREND_SERIES.some((s) => t[s.key]));
  if (!hasData) {
    return (
      <EmptyState
        icon={<LineChart size={22} />}
        title="No tagged cash flow yet"
        body="Tag a record as Expenditure, Protection, Income or Investment to see it charted here."
        action={
          <Link to="/app/transactions" className="text-xs font-semibold text-brand-500 link-underline">
            + Add a transaction
          </Link>
        }
      />
    );
  }
  const hidden = new Set(isolated ? TAG_TREND_SERIES.filter((s) => s.key !== isolated).map((s) => s.key) : []);
  const toggle = (key) => setIsolated((curr) => (curr === key ? null : key));
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trend} margin={{ left: -20, right: 8 }}>
            <defs>
              {TAG_TREND_SERIES.map((s) => (
                <linearGradient key={s.key} id={`${s.key}Grad`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} width={0} />
            <Tooltip content={<ChartTip />} />
            {TAG_TREND_SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} fill={`url(#${s.key}Grad)`} strokeWidth={2} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <CashFlowLegend series={TAG_TREND_SERIES} hidden={hidden} onToggle={toggle} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function InfoTip({ text }) {
  return (
    <span className="group/tip relative inline-flex shrink-0">
      <Info size={12} className="cursor-help text-subtle" />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-lg border border-line-strong bg-surface p-2.5 text-[11px] font-normal leading-snug text-muted opacity-0 shadow-card transition group-hover/tip:opacity-100">
        {text}
      </span>
    </span>
  );
}

const HEALTH_OVERALL_INFO = 'Average of the factors below (each scored 0–100). Only factors with enough data to compute are included.';
const HEALTH_FACTOR_INFO = {
  'Budget Adherence': 'How closely you’re staying within your category budgets this period: 100 means everything is under limit, and it drops the further over budget you go.',
  'Savings Rate': 'The share of this month’s income you kept instead of spending: (Income − Expense) ÷ Income × 100.',
  'Debt Load': 'Outstanding debt compared to your total account balances. Little or no debt relative to assets scores high; heavy debt relative to assets scores low.',
  'Emergency Fund': 'Months of average spending your liquid balance (non-credit accounts) could cover, out of a 6-month target. 6+ months = 100.',
};

// The raw numbers behind a factor's score, plus a concrete "what would move
// this number" suggestion — the doc's ask that no sub-metric stay a black
// box. `improve` is structured data from the backend (never a pre-formatted
// string) so amounts render through formatCurrency here.
function HealthFactorDetail({ b }) {
  const d = b.detail;
  if (!d) return null;
  const improve = b.improve;
  return (
    <div className="mt-2 space-y-1.5 rounded-lg bg-tint/[0.05] p-2.5 text-[11px] text-subtle">
      {b.name === 'Budget Adherence' && d.budgets.map((bud) => (
        <div key={bud.categoryName} className="flex justify-between">
          <span>{bud.categoryName}</span>
          <span className="tabular-nums">{formatCurrency(bud.spent)} / {formatCurrency(bud.limit)}</span>
        </div>
      ))}
      {b.name === 'Savings Rate' && (
        <>
          <div className="flex justify-between"><span>Income</span><span className="tabular-nums">{formatCurrency(d.income)}</span></div>
          <div className="flex justify-between"><span>Expense</span><span className="tabular-nums">{formatCurrency(d.expense)}</span></div>
          <div className="flex justify-between font-medium text-fg"><span>Saved</span><span className="tabular-nums">{formatCurrency(d.savings)}</span></div>
        </>
      )}
      {b.name === 'Debt Load' && (
        <>
          <div className="flex justify-between"><span>Total debt</span><span className="tabular-nums">{formatCurrency(d.totalDebt)}</span></div>
          <div className="flex justify-between"><span>Total assets</span><span className="tabular-nums">{formatCurrency(d.totalAssets)}</span></div>
        </>
      )}
      {b.name === 'Emergency Fund' && (
        <>
          <div className="flex justify-between"><span>Liquid balance</span><span className="tabular-nums">{formatCurrency(d.liquidBalance)}</span></div>
          <div className="flex justify-between"><span>Avg. monthly expense</span><span className="tabular-nums">{formatCurrency(d.avgMonthlyExpense)}</span></div>
          <div className="flex justify-between font-medium text-fg"><span>Months covered</span><span className="tabular-nums">{d.monthsCovered}</span></div>
        </>
      )}
      {improve && improve.type !== 'none' && (
        <p className="border-t border-line pt-1.5 text-fg">
          {improve.type === 'budget' && <>{improve.categoryName} is at {improve.pctUsed}% of its budget — the biggest lever to raise this score.</>}
          {improve.type === 'savings_rate' && <>Cutting {formatCurrency(improve.neededCut)} off this month's expenses would push savings rate to 60%.</>}
          {improve.type === 'debt' && <>Paying down {formatCurrency(improve.suggestedPaydown)} of debt would raise this score meaningfully.</>}
          {improve.type === 'emergency_fund' && <>{formatCurrency(improve.shortfall)} more in liquid savings would reach the 6-month target.</>}
        </p>
      )}
    </div>
  );
}

export function HealthWidget({ data }) {
  const breakdown = data.healthBreakdown || [];
  const [expanded, setExpanded] = useState(null);
  if (!breakdown.length) {
    return (
      <EmptyState
        icon={<ShieldCheck size={22} />}
        title="Not enough data to score"
        body="Log a few transactions and set a budget to see your financial health score."
      />
    );
  }
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-brand-500/20">
          <div
            className="absolute inset-0 rounded-full border-4 border-brand-500"
            style={{ clipPath: `inset(0 0 ${100 - (data.healthScore || 0)}% 0)` }}
          />
          <span className="font-display text-lg font-bold text-fg">{data.healthScore ?? '—'}</span>
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-fg">Grade {data.healthGrade || '—'}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            Composite financial health <InfoTip text={HEALTH_OVERALL_INFO} />
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {breakdown.map((b) => {
          const isOpen = expanded === b.name;
          return (
            <div key={b.name}>
              <button
                type="button"
                onClick={() => setExpanded((curr) => (curr === b.name ? null : b.name))}
                className="flex w-full items-center justify-between text-xs"
              >
                <span className="flex items-center gap-1.5 text-muted">
                  {b.name}
                  {HEALTH_FACTOR_INFO[b.name] && <InfoTip text={HEALTH_FACTOR_INFO[b.name]} />}
                </span>
                <span className="font-semibold text-fg">{b.score}</span>
              </button>
              <ProgressBar value={b.score} size="xs" className="mt-1" />
              {b.note && <p className="mt-1 text-[11px] text-subtle">{b.note}</p>}
              {isOpen && <HealthFactorDetail b={b} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function ExpensesStructureWidget({ data, categories }) {
  const spend = data.categorySpend || [];
  const total = spend.reduce((s, c) => s + c.amount, 0);
  const top5 = spend.slice(0, 5);

  if (!spend.length) {
    return (
      <EmptyState
        icon={<PieChartIcon size={22} />}
        title="Nothing to slice yet"
        body="Once you log some expenses, they'll show up here as a category donut."
        action={
          <Link to="/app/transactions" className="text-xs font-semibold text-brand-500 link-underline">
            + Log an expense
          </Link>
        }
      />
    );
  }

  const chartData = dedupeChartColors(top5.map((c) => ({ ...c, name: catMeta(categories, c.categoryId).name, color: catMeta(categories, c.categoryId).color })));

  return (
    <div>
      <div className="relative mx-auto h-40 w-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="amount" nameKey="name" innerRadius={48} outerRadius={68} paddingAngle={2}>
              {chartData.map((c, i) => (
                <Cell key={i} fill={c.color} />
              ))}
            </Pie>
            <Tooltip content={<CategoryTip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase tracking-wide text-subtle">Total</p>
          <p className="font-display text-sm font-bold text-fg">{formatCurrency(total)}</p>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {chartData.map((c) => (
          <div key={c.categoryId}>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name}
              </span>
              <span className="font-medium text-fg">{formatCurrency(c.amount)}</span>
            </div>
            <ProgressBar value={c.amount} max={total} size="xs" color={c.color} className="mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function BillsWidget({ data, accounts }) {
  const bills = data.upcomingBills || [];
  if (!bills.length) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} />}
        title="No upcoming bills"
        body="Recurring bills and their due dates will show up here."
        action={
          <Link to="/app/bills" className="text-xs font-semibold text-brand-500 link-underline">
            + Add a bill
          </Link>
        }
      />
    );
  }
  // Same "available" definition as the AI Daily Summary: non-credit accounts,
  // negative balances floored at zero — so this line and that one never
  // disagree about what "available" means.
  const available = (accounts || []).filter((a) => a.type !== 'credit').reduce((s, a) => s + Math.max(0, a.balance), 0);
  const billsTotal = bills.reduce((s, b) => s + Math.abs(b.amount), 0);
  const afterBills = available - billsTotal;
  return (
    <div className="space-y-3">
      {bills.map((b) => {
        const days = Math.round((new Date(b.dueDate) - new Date()) / 86400000);
        const urgent = days <= 5;
        return (
          <div key={b.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{b.name}</p>
              <p className="text-xs text-subtle">{formatDate(b.dueDate)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-sm font-semibold text-fg">{formatCurrency(b.amount)}</span>
              {urgent && <Chip tone="danger">{days < 0 ? 'Overdue' : `${days}d`}</Chip>}
            </div>
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-line pt-2.5 text-xs">
        <span className="text-subtle">Balance after these bills</span>
        <span className={`font-semibold tabular-nums ${afterBills < 0 ? 'text-rose-500' : 'text-fg'}`}>{formatCurrency(afterBills)}</span>
      </div>
      <Link to="/app/bills" className="mt-1 flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline">
        View all <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function GoalsWidget({ data }) {
  const goals = [...(data.goals || [])].sort((a, b) => {
    const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rank !== 0) return rank;
    return b.saved / b.target - a.saved / a.target;
  }).slice(0, 3);
  if (!goals.length) {
    return (
      <EmptyState
        icon={<Target size={22} />}
        title="No goals yet"
        body="Set a target — a trip, an emergency fund, a laptop — and watch progress."
        action={
          <Link to="/app/goals" className="text-xs font-semibold text-brand-500 link-underline">
            + Create a goal
          </Link>
        }
      />
    );
  }
  return (
    <div className="space-y-4">
      {goals.map((g) => {
        const pct = Math.min(100, (g.saved / g.target) * 100);
        return (
          <div key={g.id}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-fg">{g.name}</span>
              <span className="text-subtle">{Math.round(pct)}%</span>
            </div>
            <ProgressBar value={pct} size="xs" color={g.color} className="mt-1.5" />
          </div>
        );
      })}
      <Link to="/app/goals" className="flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline">
        View all <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function TransactionsWidget({ data, categories, accounts }) {
  const txns = data.recentTransactions || [];
  if (!txns.length) {
    return (
      <EmptyState
        icon={<ArrowLeftRight size={22} />}
        title="No transactions yet"
        body="Every income, expense, and transfer will appear here as you log them."
        action={
          <Link to="/app/transactions" className="text-xs font-semibold text-brand-500 link-underline">
            + Add your first transaction
          </Link>
        }
      />
    );
  }
  return (
    <div className="divide-y divide-line">
      {txns.map((t) => {
        const cat = catMeta(categories, t.categoryId);
        const isTransfer = t.type === 'transfer';
        const from = isTransfer ? accMeta(accounts, t.fromAccountId) : null;
        const to = isTransfer ? accMeta(accounts, t.toAccountId) : null;
        return (
          <div key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cat.color}22`, color: cat.color }}>
                <DynamicIcon name={cat.icon} size={16} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{t.vendor}</p>
                <p className="truncate text-xs text-subtle">
                  {isTransfer ? `${from?.name || '—'} → ${to?.name || '—'}` : cat.name} · {formatDate(t.date)}
                </p>
              </div>
            </div>
            <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.amount < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {t.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function computeInsight(data) {
  const trend = data.spendingTrend || [];
  const categories = data.categories || [];
  const last = trend[trend.length - 1];
  const prev = trend[trend.length - 2];

  if (last && prev && prev.expense > 0) {
    const delta = ((last.expense - prev.expense) / prev.expense) * 100;
    if (Math.abs(delta) >= 5) {
      return {
        title: delta < 0 ? 'Spending is trending down' : 'Spending is trending up',
        body: `You've spent ${Math.abs(delta).toFixed(0)}% ${delta < 0 ? 'less' : 'more'} this month than last month.`,
      };
    }
  }

  const catSpend = data.categorySpend || [];
  if (catSpend.length) {
    const top = catSpend[0];
    const cat = categories.find((c) => c.id === top.categoryId);
    return {
      title: `${cat?.name || 'One category'} leads this month`,
      body: `${cat?.name || 'This category'} accounts for the largest share of your spending so far this month.`,
    };
  }

  if (last && !prev) {
    return { title: 'Just getting started', body: "This is your first month of data — keep logging transactions to unlock trends." };
  }

  if (last && last.income > 0 && last.expense === 0) {
    return { title: 'Income logged, no expenses yet', body: "You've recorded income this month but no expenses — nice start." };
  }

  return { title: 'Add a transaction to get insights', body: 'Once you log a few transactions, this card will surface real spending patterns.' };
}

export function InsightWidget({ data }) {
  const insight = computeInsight(data);
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
        <Sparkles size={20} />
      </div>
      <div>
        <p className="font-display text-base font-semibold text-fg">{insight.title}</p>
        <p className="mt-1 text-sm text-muted">{insight.body}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function BalanceTrendWidget({ data }) {
  const trend = data.spendingTrend || [];
  let running = 0;
  const chartData = trend.map((t) => {
    running += t.income - t.expense;
    return { month: t.month, net: running };
  });
  return (
    <div>
      <p className="mb-3 text-xs text-subtle">Cumulative net cash flow</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart data={chartData} margin={{ left: -20, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} width={0} />
            <Tooltip content={<ChartTip />} />
            <Line type="monotone" dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2.5} dot={false} />
          </RLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function PeriodComparisonWidget({ data }) {
  const trend = data.spendingTrend || [];
  const curr = trend[trend.length - 1];
  const prev = trend[trend.length - 2];
  if (!curr) return <EmptyState title="Not enough data" body="Track a month of activity to compare periods." />;
  const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : 0);
  const rows = [
    { label: 'Income', curr: curr.income, prev: prev?.income || 0 },
    { label: 'Expense', curr: curr.expense, prev: prev?.expense || 0 },
  ];
  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const delta = pct(r.curr, r.prev);
        const positive = r.label === 'Income' ? delta >= 0 : delta <= 0;
        return (
          <div key={r.label} className="flex items-center justify-between">
            <div>
              <p className="text-xs text-subtle">{r.label}</p>
              <p className="font-display text-base font-bold text-fg">{formatCurrency(r.curr)}</p>
            </div>
            <span className={`text-xs font-semibold ${positive ? 'text-emerald-500' : 'text-rose-500'}`}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}% vs last month
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
function vendorColor(name, index) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[(hash || index) % CATEGORY_COLORS.length];
}
function truncateLabel(name, max = 12) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}
function VendorTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs shadow-soft">
      <p className="flex items-center gap-1.5 font-semibold text-fg">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.color }} /> {row.vendor}
      </p>
      <p className="mt-0.5 font-medium tabular-nums text-fg">{formatCurrency(row.amount)}</p>
    </div>
  );
}

// Named "Top Payees" (not "Top Vendors") deliberately: the backend already
// excludes debt-payment transactions from this list (a loan repayment's
// vendor is the debt's own name, not a merchant), so what's left is
// specifically who you paid — distinct from Expenses Structure, which is
// where the money went by category.
export function TopVendorsWidget() {
  const [vendors, setVendors] = useState(null);
  useEffect(() => {
    reportsApi.get().then((r) => setVendors(r?.topVendors || [])).catch(() => setVendors([]));
  }, []);
  if (vendors === null) return <p className="text-sm text-subtle">Loading…</p>;
  if (!vendors.length) return <EmptyState title="No payee data yet" body="Top payees will appear once you log expenses." />;
  const chartData = vendors.slice(0, 5).map((v, i) => ({ ...v, color: vendorColor(v.vendor, i), label: truncateLabel(v.vendor, 8) }));
  return (
    <div style={{ height: 240 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 4, right: 4, top: 24, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} />
          <YAxis hide />
          <Tooltip content={<VendorTip />} cursor={{ fill: 'rgba(127,127,127,0.08)' }} />
          <Bar dataKey="amount" name="Spent" radius={[6, 6, 0, 0]} barSize={32}>
            {chartData.map((v, i) => <Cell key={i} fill={v.color} />)}
            <LabelList
              dataKey="amount" position="top"
              formatter={(v) => formatCurrency(v)}
              style={{ fontSize: 9, fontWeight: 600, fill: 'rgb(var(--fg))' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function SavingsRateWidget({ data }) {
  const rate = data.metrics?.savingsRate ?? 0;
  const delta = data.metrics?.savingsRateDelta ?? 0;
  return (
    <div>
      <p className="font-display text-3xl font-bold text-fg">{rate.toFixed(1)}%</p>
      <p className="mt-1 text-xs text-subtle">of income saved this month</p>
      <ProgressBar value={Math.max(0, rate)} max={100} className="mt-4" />
      {!!delta && (
        <p className={`mt-2 text-xs font-semibold ${delta > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last month
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cash flow isn't in this registry — like the Account Cards row, it's now a
// permanently pinned widget (paired with the AI Daily Summary in a fixed top
// row in Dashboard.jsx) rather than a draggable/removable grid item.
// CashFlowWidget itself is still exported above for that direct use.
export const WIDGET_REGISTRY = {
  health: { title: 'Financial health', subtitle: 'Composite score, refreshed daily', defaultSpan: 1, icon: ShieldCheck, Component: HealthWidget, category: 'Insights & Health Score' },
  'expenses-structure': { title: 'Expenses structure', subtitle: 'How your spending splits this month', defaultSpan: 1, icon: PieChartIcon, Component: ExpensesStructureWidget, category: 'Spending & Budgets' },
  bills: { title: 'Upcoming bills', subtitle: 'Next 30 days', defaultSpan: 1, icon: CalendarDays, Component: BillsWidget, category: 'Bills & Reminders' },
  goals: { title: 'Top goals', subtitle: 'Progress toward your targets', defaultSpan: 1, icon: Target, Component: GoalsWidget, category: 'Goals & Savings' },
  transactions: { title: 'Recent transactions', subtitle: 'Latest 8 rows', defaultSpan: 3, icon: ArrowLeftRight, Component: TransactionsWidget, category: 'Accounts & Vendors' },
  insight: { title: "This month's insight", defaultSpan: 3, icon: Sparkles, Component: InsightWidget, category: 'Insights & Health Score' },
  'balance-trend': { title: 'Balance trend', subtitle: 'Total across accounts', defaultSpan: 1, icon: Activity, Component: BalanceTrendWidget, category: 'Cash Flow & Trends' },
  'period-comparison': { title: 'Period-to-period', subtitle: 'This month vs last month', defaultSpan: 1, icon: ArrowLeftRight, Component: PeriodComparisonWidget, category: 'Cash Flow & Trends' },
  'top-vendors': { title: 'Top payees', subtitle: "Who you're paying the most", defaultSpan: 1, icon: Store, Component: TopVendorsWidget, category: 'Accounts & Vendors' },
  'savings-rate': { title: 'Savings rate', subtitle: 'Income minus expense, as a %', defaultSpan: 1, icon: PiggyBank, Component: SavingsRateWidget, category: 'Goals & Savings' },
  ...AI_WIDGET_REGISTRY,
};
