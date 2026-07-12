import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles, Wallet, AlertTriangle, CalendarClock, PieChart as PieChartIcon,
  TrendingDown, TrendingUp, PiggyBank, ShieldCheck, Copy, Repeat, LineChart,
  ChevronDown, ArrowRight, AlertOctagon, Target,
} from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { Chip, EmptyState, Card, CardHeader } from '../../components/ui/index.js';
import { CATEGORY_COLORS } from '../../lib/categoryIcons.js';
import { formatCurrency, formatDate, budgetsApi } from '../../lib/api.js';
import { useNewTransaction } from '../../context/NewTransactionContext.jsx';

const TONE_ICON_CLASS = {
  danger: 'bg-rose-500/15 text-rose-500',
  warning: 'bg-amber-500/15 text-amber-500',
  positive: 'bg-emerald-500/15 text-emerald-500',
  info: 'bg-brand-500/15 text-brand-500',
};
const TYPE_ICON = {
  available_balance: Wallet,
  bill_overdue: AlertTriangle,
  bill_due: CalendarClock,
  subscription_renewal: Repeat,
  budget_hot: PieChartIcon,
  spend_vs_last_month: TrendingDown,
  smart_savings: PiggyBank,
  smart_savings_insufficient_data: PiggyBank,
  unusual_duplicates: Copy,
  unusual_transaction: AlertOctagon,
  no_unusual: ShieldCheck,
  week_spend_vs_last_week: TrendingDown,
  week_bills_due: CalendarClock,
  week_budget_pace: PieChartIcon,
  week_largest_expense: AlertOctagon,
};

function relativeDays(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

function summarySentence(item) {
  switch (item.type) {
    case 'available_balance':
      return <>You have <strong className="font-semibold text-fg">{formatCurrency(item.amount)}</strong> available — after {formatCurrency(item.citation.billsTotal)} in upcoming bills this month.</>;
    case 'bill_overdue':
      return <>{item.count} bill{item.count > 1 ? 's are' : ' is'} overdue.</>;
    case 'bill_due':
      return <><strong className="font-semibold text-fg">{item.name}</strong> is due {relativeDays(item.days)} ({formatCurrency(item.amount)}).</>;
    case 'subscription_renewal':
      return <><strong className="font-semibold text-fg">{item.name}</strong> renews {relativeDays(item.days)} (~{formatCurrency(item.amount)}).</>;
    case 'budget_hot':
      return <><strong className="font-semibold text-fg">{item.categoryName}</strong> budget has reached {item.pct}%.</>;
    case 'spend_vs_last_month':
      return <>You spent {item.pct}% {item.direction} than last month.</>;
    case 'smart_savings':
      return <>Based on your upcoming bills, budget allocations, debts and goals, an estimated <strong className="font-semibold text-fg">{formatCurrency(item.amount)}</strong> is available to move to savings.</>;
    case 'smart_savings_insufficient_data':
      return <>Can't reliably estimate a savings transfer yet — set up at least one budget or bill so future commitments are accounted for.</>;
    case 'unusual_duplicates':
      return <>{item.count} possible duplicate transaction{item.count > 1 ? 's' : ''} found.</>;
    case 'unusual_transaction':
      return <>Unusual: <strong className="font-semibold text-fg">{formatCurrency(item.amount)}</strong> at {item.vendor} — {item.multiple}× your typical transaction.</>;
    case 'no_unusual':
      return item.largestAmount
        ? <>No unusual spending this week — largest transaction was {formatCurrency(item.largestAmount)} ({item.largestVendor}), consistent with your recurring pattern.</>
        : <>No unusual spending detected this week.</>;
    case 'week_spend_vs_last_week':
      return <>You've spent {formatCurrency(item.thisWeekExpense)} this week — {Math.abs(item.pct)}% {item.pct < 0 ? 'less' : 'more'} than last week.</>;
    case 'week_bills_due':
      return <>{item.count} bill{item.count > 1 ? 's' : ''} due this week, totaling {formatCurrency(item.totalAmount)}.</>;
    case 'week_budget_pace':
      return <><strong className="font-semibold text-fg">{item.categoryName}</strong> is on pace for {formatCurrency(item.projected)} against a {formatCurrency(item.limit)} weekly budget.</>;
    case 'week_largest_expense':
      return <>Largest expense this week: <strong className="font-semibold text-fg">{formatCurrency(item.amount)}</strong> at {item.vendor}.</>;
    default:
      return null;
  }
}

// The raw numbers/transactions behind each claim — the doc's traceability
// requirement applied to the daily summary specifically: no line should be a
// black box the user has to take on faith.
function CitationDetail({ item }) {
  const c = item.citation;
  if (!c) return null;
  switch (item.type) {
    case 'available_balance':
      return (
        <div className="space-y-2">
          {c.accounts.map((a) => (
            <div key={a.name} className="flex justify-between"><span>{a.name}</span><span className="tabular-nums">{formatCurrency(a.balance)}</span></div>
          ))}
          {c.bills.length > 0 && (
            <>
              <p className="pt-1 font-medium text-fg">Bills due this month</p>
              {c.bills.map((b) => (
                <div key={b.id} className="flex justify-between"><span>{b.name} · {formatDate(b.dueDate)}</span><span className="tabular-nums">{formatCurrency(b.amount)}</span></div>
              ))}
            </>
          )}
        </div>
      );
    case 'bill_overdue':
      return (
        <div className="space-y-1">
          {c.bills.map((b) => (
            <div key={b.id} className="flex justify-between"><span>{b.name}</span><span className="tabular-nums">{formatCurrency(b.amount)} · was due {formatDate(b.dueDate)}</span></div>
          ))}
        </div>
      );
    case 'bill_due':
      return <p>Due {formatDate(c.dueDate)}{c.frequency ? ` · repeats ${c.frequency}` : ''}.</p>;
    case 'subscription_renewal':
      return <p>Seen {c.occurrences} times before, last on {formatDate(c.lastDate)}. Next expected {formatDate(c.nextExpectedDate)}.</p>;
    case 'budget_hot':
      return (
        <div className="space-y-1">
          <p className="font-medium text-fg">{formatCurrency(c.spent)} of {formatCurrency(c.limit)} spent this period</p>
          {c.transactions.map((t) => (
            <div key={t.id} className="flex justify-between"><span>{t.vendor} · {formatDate(t.date)}</span><span className="tabular-nums">{formatCurrency(t.amount)}</span></div>
          ))}
        </div>
      );
    case 'spend_vs_last_month':
      return <p>{formatCurrency(c.thisMonth)} spent this month so far.</p>;
    case 'smart_savings':
      return (
        <div className="space-y-1">
          <div className="flex justify-between"><span>Liquid balance</span><span className="tabular-nums">{formatCurrency(c.liquidBalance)}</span></div>
          <div className="flex justify-between"><span>− Bills & scheduled payments (30d)</span><span className="tabular-nums">{formatCurrency(c.billsReserved)}</span></div>
          <div className="flex justify-between"><span>− Remaining budget allocations</span><span className="tabular-nums">{formatCurrency(c.budgetsReserved)}</span></div>
          <div className="flex justify-between"><span>− Debt payments due (30d)</span><span className="tabular-nums">{formatCurrency(c.debtsReserved)}</span></div>
          <div className="flex justify-between"><span>− Committed goal contributions</span><span className="tabular-nums">{formatCurrency(c.goalsReserved)}</span></div>
          <div className="flex justify-between"><span>− Typical unplanned spending</span><span className="tabular-nums">{formatCurrency(c.unbudgetedBuffer)}</span></div>
          <div className="flex justify-between border-t border-line pt-1 font-medium text-fg"><span>= Available to save</span><span className="tabular-nums">{formatCurrency(c.availableToSave)}</span></div>
        </div>
      );
    case 'unusual_duplicates':
      return (
        <div className="space-y-1">
          {c.duplicates.map((d) => (
            <div key={d.id} className="flex justify-between"><span>{d.vendor}</span><span className="tabular-nums">{formatCurrency(d.amount)} · {formatDate(d.firstDate)} & {formatDate(d.secondDate)}</span></div>
          ))}
        </div>
      );
    case 'unusual_transaction':
      return <p>Your typical expense is {formatCurrency(c.medianAmount)} (trailing 90 days) — this one was on {formatDate(c.date)}.</p>;
    case 'no_unusual':
      return <p>On {formatDate(c.date)}.</p>;
    case 'week_spend_vs_last_week':
      return <p>This week starts {formatDate(c.thisWeekStart)}; last week was {formatDate(c.lastWeekStart)}–{formatDate(c.lastWeekEnd)}.</p>;
    case 'week_bills_due':
      return (
        <div className="space-y-1">
          {c.bills.map((b) => (
            <div key={b.id} className="flex justify-between"><span>{b.name}</span><span className="tabular-nums">{formatCurrency(b.amount)} · {formatDate(b.dueDate)}</span></div>
          ))}
        </div>
      );
    case 'week_budget_pace':
      return <p>{formatCurrency(c.spent)} spent so far this week.</p>;
    default:
      return null;
  }
}

function ActionButton({ action }) {
  const { openPrefilled } = useNewTransaction();
  if (!action) return null;
  if (action.kind === 'prefill_transfer') {
    return (
      <button
        type="button"
        onClick={() => openPrefilled({ type: 'transfer', ...action.prefill })}
        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline"
      >
        {action.label} <ArrowRight size={12} />
      </button>
    );
  }
  return (
    <Link to={action.to} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline">
      {action.label} <ArrowRight size={12} />
    </Link>
  );
}

function SummaryRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TYPE_ICON[item.type] || Sparkles;
  const hasDetail = !!item.citation;
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE_ICON_CLASS[item.tone] || TONE_ICON_CLASS.info}`}>
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => hasDetail && setExpanded((e) => !e)}
          className={`flex w-full items-start justify-between gap-2 text-left text-sm leading-snug text-muted ${hasDetail ? 'cursor-pointer hover:text-fg' : 'cursor-default'}`}
        >
          <span>{summarySentence(item)}</span>
          {hasDetail && <ChevronDown size={14} className={`mt-0.5 shrink-0 text-subtle transition ${expanded ? 'rotate-180' : ''}`} />}
        </button>
        {expanded && hasDetail && (
          <div className="mt-2 rounded-lg bg-tint/[0.05] p-2.5 text-xs text-subtle">
            <CitationDetail item={item} />
          </div>
        )}
        {item.action && <div className="mt-1.5"><ActionButton action={item.action} /></div>}
      </div>
    </li>
  );
}

// Always-visible section (not part of the customizable widget grid) — the
// doc's "highest priority" ask is that this appears near the top of the
// dashboard every day, not something a user could drag away or forget to add.
// Every line is clickable (expands to the citation behind the claim) and,
// where there's something to do about it, carries an action button.
export function AIDailySummaryCard({ items }) {
  if (!items || !items.length) return null;
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="AI Daily Summary"
        subtitle="What matters today — tap a line for the numbers behind it"
        right={<Sparkles size={16} className="text-subtle" />}
      />
      <ul className="space-y-3">
        {items.map((item) => <SummaryRow key={item.id} item={item} />)}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Same item-array / SummaryRow rendering as the always-visible daily summary
// above, just week-scoped — a customizable-grid widget rather than a fixed
// section, since a week-over-week view is useful but not "check every day"
// urgent the way the daily summary is.
export function AIWeeklySummaryWidget({ data }) {
  const items = data.weeklySummary || [];
  if (!items.length) {
    return <EmptyState icon={<CalendarClock size={22} />} title="Nothing to report yet" body="Weekly insights will appear here once you have some activity this week." />;
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => <SummaryRow key={item.id} item={item} />)}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Composition-only recommendations from RecommendationEngine — every item
// already traces back to a specific analysis service's output (health
// score, budget pace, unused budgets, etc.), so this is purely a ranked
// display, not a new source of claims.
export function AIRecommendationsWidget({ data }) {
  const recommendations = data.recommendations || [];
  if (!recommendations.length) {
    return <EmptyState icon={<Sparkles size={22} />} title="You're in good shape" body="No pressing recommendations right now — check back as your data grows." />;
  }
  return (
    <div className="space-y-4">
      {recommendations.map((r) => (
        <div key={r.id} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
            <Sparkles size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">{r.title}</p>
            <p className="text-xs text-subtle">{r.body}</p>
            {r.action && <div className="mt-1"><ActionButton action={r.action} /></div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AICashFlowForecastWidget({ data }) {
  const cf = data.cashFlow;
  if (!cf) return <EmptyState icon={<LineChart size={22} />} title="Not enough data yet" body="Log a few weeks of transactions to unlock a cash flow forecast." />;
  const rows = [
    { label: '7 days', value: cf.sevenDay },
    { label: '30 days', value: cf.thirtyDay },
    { label: `End of month (${cf.endOfMonthDays}d)`, value: cf.endOfMonth },
  ];
  return (
    <div>
      <p className="text-xs text-subtle">Projected balance across accounts</p>
      <p className="mt-1 font-display text-2xl font-bold text-fg">{formatCurrency(cf.current)}</p>
      <p className="text-xs text-subtle">today</p>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted">{r.label}</span>
            <span className={`font-semibold tabular-nums ${r.value < cf.current ? 'text-rose-500' : 'text-emerald-500'}`}>
              {formatCurrency(r.value)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-subtle">Based on your trailing 3-month average daily cash flow.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AIBudgetPredictionsWidget({ data }) {
  const predictions = data.budgetPredictions || [];
  const unused = data.unusedBudgets || [];
  if (!predictions.length && !unused.length) {
    return <EmptyState icon={<ShieldCheck size={22} />} title="On pace" body="No budgets are projected to exceed their limit at your current spending rate." />;
  }
  return (
    <div className="space-y-5">
      {predictions.length > 0 && (
        <div className="space-y-4">
          {predictions.map((p) => {
            const pct = Math.min(150, Math.round((p.projected / p.limit) * 100));
            return (
              <div key={p.budgetId}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-fg">{p.categoryName}</span>
                  <Chip tone="warning">{pct}% projected</Chip>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  On pace for {formatCurrency(p.projected)} of a {formatCurrency(p.limit)} {p.period} budget.
                </p>
              </div>
            );
          })}
        </div>
      )}
      {unused.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">Going unused</p>
          <div className="space-y-2">
            {unused.map((u) => (
              <div key={u.budgetId} className="flex items-center justify-between text-xs">
                <span className="font-medium text-fg">{u.categoryName}</span>
                <span className="text-subtle">{u.avgPctUsed}% used avg. over {u.periodsChecked} periods</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function RecurringRow({ p }) {
  const urgent = p.daysUntil >= 0 && p.daysUntil <= 3;
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-fg">{p.vendor}</p>
        <p className="text-xs text-subtle">Next {formatDate(p.nextExpectedDate)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-fg">{formatCurrency(p.avgAmount)}</span>
        {urgent && <Chip tone="warning">{p.daysUntil <= 0 ? 'Due' : `${p.daysUntil}d`}</Chip>}
      </div>
    </div>
  );
}

export function AIRecurringWidget({ data }) {
  const subscriptions = data.subscriptions || [];
  const recurring = data.recurring || [];
  if (!subscriptions.length && !recurring.length) {
    return <EmptyState icon={<Repeat size={22} />} title="Nothing detected yet" body="Once a vendor repeats on a roughly monthly cadence, it'll show up here automatically." />;
  }
  return (
    <div className="space-y-5">
      {subscriptions.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">Subscriptions</p>
          <div className="space-y-3">
            {subscriptions.slice(0, 4).map((p) => <RecurringRow key={p.vendor} p={p} />)}
          </div>
        </div>
      )}
      {recurring.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">Recurring</p>
          <div className="space-y-3">
            {recurring.slice(0, 4).map((p) => <RecurringRow key={p.vendor} p={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export function AISpendingInsightsWidget({ data }) {
  const insights = data.spendingInsights || [];
  if (!insights.length) {
    return <EmptyState icon={<Sparkles size={22} />} title="Nothing notable yet" body="Category spending changes of 15%+ vs. last month will show up here." />;
  }
  return (
    <div className="space-y-4">
      {insights.map((i) => {
        const up = i.pct > 0;
        const Icon = up ? TrendingUp : TrendingDown;
        return (
          <div key={i.categoryId} className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${up ? 'bg-rose-500/15 text-rose-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
              <Icon size={14} />
            </span>
            <p className="text-sm text-muted">
              <strong className="font-semibold text-fg">{i.categoryName}</strong> spending {up ? 'increased' : 'decreased'} {Math.abs(i.pct)}% vs. last month.
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
const GOAL_INSIGHT_ICON = { goal_contribution_this_month: PiggyBank, goal_progress: Target, goal_deadline_shortfall: AlertTriangle };

export function AIGoalInsightsWidget({ data }) {
  const insights = data.goalInsights || [];
  const forecasts = (data.goalCompletionForecast || []).filter((f) => !f.insufficientData);
  const required = data.requiredMonthlyContribution || [];
  if (!insights.length && !forecasts.length && !required.length) {
    return <EmptyState icon={<Target size={22} />} title="No goal activity yet" body="Contribute to a savings goal to see progress insights here." />;
  }
  return (
    <div className="space-y-4">
      {insights.map((i) => {
        const Icon = GOAL_INSIGHT_ICON[i.type] || Sparkles;
        return (
          <div key={i.id} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
              <Icon size={14} />
            </span>
            <p className="text-sm text-muted">
              {i.type === 'goal_contribution_this_month' && (
                <>You contributed <strong className="font-semibold text-fg">{formatCurrency(i.amount)}</strong> toward your {i.goalName} this month.</>
              )}
              {i.type === 'goal_progress' && (
                <>You've reached <strong className="font-semibold text-fg">{i.pct}%</strong> of your {i.goalName} goal.</>
              )}
              {i.type === 'goal_deadline_shortfall' && (
                <>You need another <strong className="font-semibold text-fg">{formatCurrency(i.amount)}</strong> to reach your {i.goalName} goal before {formatDate(i.deadline)} ({i.daysLeft} days left).</>
              )}
            </p>
          </div>
        );
      })}
      {forecasts.map((f) => (
        <div key={`forecast_${f.goalId}`} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
            <CalendarClock size={14} />
          </span>
          <p className="text-sm text-muted">
            At your current pace, <strong className="font-semibold text-fg">{f.goalName}</strong> is projected to be fully funded around {formatDate(f.projectedCompletionDate)}.
          </p>
        </div>
      ))}
      {required.map((r) => (
        <div key={`required_${r.goalId}`} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <AlertTriangle size={14} />
          </span>
          <p className="text-sm text-muted">
            Contribute <strong className="font-semibold text-fg">{formatCurrency(r.requiredMonthlyContribution)}</strong>/month more to {r.goalName} to hit your {formatDate(r.deadline)} deadline.
          </p>
        </div>
      ))}
      <Link to="/app/goals" className="flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline">
        View goals <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "₹15,117 of ₹18,000 spent" per category, with remaining headroom — distinct
// from the Financial Health Score's single aggregate Budget Adherence
// number, this is the per-category breakdown the doc asks for. Fetches its
// own data (like Top Payees below) since /api/budgets isn't part of the
// bundled dashboard/AI-insights payload.
function BudgetPctTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const remaining = row.limit - row.spent;
  return (
    <div className="rounded-xl border border-line-strong bg-surface px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold text-fg">{row.name}</p>
      <p className="mt-0.5 tabular-nums text-muted">{formatCurrency(row.spent)} of {formatCurrency(row.limit)}</p>
      <p className={`tabular-nums ${remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
        {remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`}
      </p>
    </div>
  );
}

// Charted as % of budget used per category, color-coded green/amber/red,
// with a dashed line at 100%. A currency-scaled bar (spent vs. a category's
// own limit) looks empty for any category well under budget and makes
// categories with small limits invisible next to large ones; normalizing to
// a percentage keeps every category legible on the same 0–100%+ scale
// regardless of its absolute limit, and the 100% line makes "over budget"
// unambiguous at a glance.
export function AIBudgetAdherenceWidget() {
  const [budgets, setBudgets] = useState(null);
  React.useEffect(() => {
    budgetsApi.list().then((b) => setBudgets(b || [])).catch(() => setBudgets([]));
  }, []);
  if (budgets === null) return <p className="text-sm text-subtle">Loading…</p>;
  if (!budgets.length) {
    return (
      <EmptyState
        icon={<PieChartIcon size={22} />}
        title="No budgets yet"
        body="Set a budget per category to track spent vs. remaining here."
        action={<Link to="/app/budgets" className="text-xs font-semibold text-brand-500 link-underline">+ Add a budget</Link>}
      />
    );
  }
  // Each bar takes its category's own color (the same one used everywhere
  // else — transaction icons, Expenses Structure) so a category reads as
  // the same color across the whole app; two categories sharing a stored
  // color get bumped to the next free one from the shared palette so
  // adjacent bars stay distinguishable. Overspent categories turn red
  // regardless of their usual color — that warning always wins.
  const usedColors = new Set();
  const chartData = budgets.slice(0, 6).map((b) => {
    const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
    let color = b.category?.color || CATEGORY_COLORS[0];
    if (usedColors.has(color)) color = CATEGORY_COLORS.find((c) => !usedColors.has(c)) || color;
    usedColors.add(color);
    return {
      name: b.category?.name || 'Budget',
      pct: Math.round(pct),
      barHeight: Math.min(140, pct),
      spent: b.spent,
      limit: b.limit,
      color: pct >= 100 ? '#f43f5e' : color,
    };
  });
  const maxPct = Math.max(100, ...chartData.map((d) => d.barHeight));
  return (
    <div>
      <div style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 8, top: 20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
            <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
            <YAxis domain={[0, maxPct]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} width={34} />
            <ReferenceLine y={100} stroke="rgb(var(--subtle))" strokeDasharray="4 4" />
            <Tooltip content={<BudgetPctTip />} cursor={{ fill: 'rgba(127,127,127,0.08)' }} />
            <Bar dataKey="barHeight" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              <LabelList dataKey="pct" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 10, fontWeight: 600, fill: 'rgb(var(--fg))' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Category names as a legend below the chart, not cramped x-axis ticks —
          plain text wraps and stays legible regardless of how narrow the
          widget is, unlike SVG tick labels which collide with 5+ categories. */}
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
        {chartData.map((d) => (
          <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Specific flagged transactions with a reason ("3.6× your typical
// transaction") rather than a generic "all clear" — the doc's anomaly
// citation requirement, as its own dedicated widget (the daily summary only
// ever surfaces the single largest one).
export function AIAnomaliesWidget({ data }) {
  const anomalies = data.anomalies || [];
  if (!anomalies.length) {
    return <EmptyState icon={<ShieldCheck size={22} />} title="Nothing unusual" body="No transactions this week stood out from your typical spending pattern." />;
  }
  return (
    <div className="space-y-4">
      {anomalies.map((a) => (
        <div key={a.transactionId} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
            <AlertOctagon size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">
              <strong className="font-semibold text-fg">{formatCurrency(a.amount)}</strong> at {a.vendor} — {a.multiple}× your typical {formatCurrency(a.medianAmount)} transaction.
            </p>
            <p className="text-xs text-subtle">{formatDate(a.date)}</p>
          </div>
        </div>
      ))}
      <Link to="/app/transactions" className="flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline">
        Review transactions <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A distinct, simpler signal from AIAnomaliesWidget: a flat top-5%-of-recent-
// spend threshold with no recurring-vendor exclusion, so a large-but-expected
// recurring payment still shows up here even though the anomalies widget
// correctly excludes it there.
export function AILargeExpenseAlertsWidget({ data }) {
  const alerts = data.largeExpenses || [];
  if (!alerts.length) {
    return <EmptyState icon={<ShieldCheck size={22} />} title="No large expenses" body="Nothing in the last 30 days stood out as unusually large." />;
  }
  return (
    <div className="space-y-4">
      {alerts.map((a) => (
        <div key={a.transactionId} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <AlertOctagon size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">
              <strong className="font-semibold text-fg">{formatCurrency(a.amount)}</strong> at {a.vendor}.
            </p>
            <p className="text-xs text-subtle">{formatDate(a.date)}</p>
          </div>
        </div>
      ))}
      <Link to="/app/transactions" className="flex items-center gap-1 text-xs font-semibold text-brand-500 link-underline">
        Review transactions <ArrowRight size={12} />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reads the Credit Utilization Health Score factor straight off the
// dashboard bundle (data.healthBreakdown) rather than fetching/computing
// anything of its own — only renders once at least one credit account has a
// creditLimit set, same gate the factor itself uses.
export function AICreditUtilizationWidget({ data }) {
  const factor = (data.healthBreakdown || []).find((f) => f.name === 'Credit Utilization');
  if (!factor) {
    return <EmptyState icon={<PieChartIcon size={22} />} title="No credit limit set" body="Add a credit limit to one of your credit accounts to track utilization here." />;
  }
  const { totalUsed, totalLimit, utilizationPct } = factor.detail;
  const barColor = utilizationPct >= 70 ? '#f43f5e' : utilizationPct >= 40 ? '#f59e0b' : '#10b981';
  return (
    <div>
      <p className="text-xs text-subtle">Total credit utilization</p>
      <p className="mt-1 font-display text-2xl font-bold text-fg">{utilizationPct}%</p>
      <p className="mt-1 text-xs text-subtle">{formatCurrency(totalUsed)} used of {formatCurrency(totalLimit)} total limit</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-tint/10">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, utilizationPct)}%`, background: barColor }} />
      </div>
      <p className="mt-2 text-xs text-subtle">{factor.note}</p>
    </div>
  );
}

export const AI_WIDGET_REGISTRY = {
  'ai-cashflow-forecast': { title: 'AI cash flow forecast', subtitle: '7-day, 30-day & month-end projection', defaultSpan: 1, icon: LineChart, Component: AICashFlowForecastWidget, category: 'Cash Flow & Trends' },
  'ai-budget-predictions': { title: 'Budget pace warnings', subtitle: 'Projected to exceed limit', defaultSpan: 1, icon: AlertTriangle, Component: AIBudgetPredictionsWidget, category: 'Spending & Budgets' },
  'ai-budget-adherence': { title: 'Budget adherence', subtitle: 'Spent, remaining, per category', defaultSpan: 1, icon: PieChartIcon, Component: AIBudgetAdherenceWidget, category: 'Spending & Budgets' },
  'ai-anomalies': { title: 'Unusual transactions', subtitle: 'Flagged with a specific reason', defaultSpan: 1, icon: AlertOctagon, Component: AIAnomaliesWidget, category: 'Insights & Health Score' },
  'ai-recurring': { title: 'Subscriptions & recurring', subtitle: 'Detected automatically', defaultSpan: 1, icon: Repeat, Component: AIRecurringWidget, category: 'Bills & Reminders' },
  'ai-spending-insights': { title: 'AI spending insights', subtitle: 'Notable category changes', defaultSpan: 1, icon: Sparkles, Component: AISpendingInsightsWidget, category: 'Insights & Health Score' },
  'ai-goal-insights': { title: 'Goal insights', subtitle: 'Contribution & progress narration', defaultSpan: 1, icon: Target, Component: AIGoalInsightsWidget, category: 'Goals & Savings' },
  'ai-weekly-summary': { title: 'AI weekly summary', subtitle: 'What matters this week', defaultSpan: 1, icon: CalendarClock, Component: AIWeeklySummaryWidget, category: 'Insights & Health Score' },
  'ai-recommendations': { title: 'AI recommendations', subtitle: 'Ranked, actionable suggestions', defaultSpan: 1, icon: Sparkles, Component: AIRecommendationsWidget, category: 'Insights & Health Score' },
  'ai-large-expenses': { title: 'Large expense alerts', subtitle: 'Top 5% of recent spend', defaultSpan: 1, icon: AlertOctagon, Component: AILargeExpenseAlertsWidget, category: 'Insights & Health Score' },
  'ai-credit-utilization': { title: 'Credit utilization', subtitle: 'Used vs. total credit limit', defaultSpan: 1, icon: PieChartIcon, Component: AICreditUtilizationWidget, category: 'Insights & Health Score' },
};
