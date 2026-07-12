import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, PiggyBank, Percent, Download, Sparkles, Printer, Trophy, Lightbulb } from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Button, Card, CardHeader, KpiCard, EmptyState } from '../components/ui/index.js';
import { ChartTip, CategoryTip } from '../components/ui/ChartTooltip.jsx';
import { reportsApi, aiApi, formatCurrency } from '../lib/api.js';
import { toCSV, downloadCSV } from '../lib/csv.js';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'category', label: 'By category' },
  { value: 'trends', label: 'Trends' },
  { value: 'ai-report', label: 'AI Report' },
];

function achievementText(a) {
  switch (a.type) {
    case 'under_budget':
      return <>Stayed under budget on <strong className="font-semibold text-fg">{a.categoryName}</strong> ({formatCurrency(a.spent)} of {formatCurrency(a.limit)}).</>;
    case 'spend_decrease':
      return <><strong className="font-semibold text-fg">{a.categoryName}</strong> spending dropped {a.pct}% vs. last month.</>;
    default:
      return null;
  }
}
function recommendationText(r) {
  switch (r.type) {
    case 'budget_pace':
      return <><strong className="font-semibold text-fg">{r.categoryName}</strong> is on pace for {formatCurrency(r.projected)} against a {formatCurrency(r.limit)} budget — consider slowing down.</>;
    case 'smart_savings':
      return <>Consider moving <strong className="font-semibold text-fg">{formatCurrency(r.amount)}</strong> into savings.</>;
    case 'spend_increase':
      return <><strong className="font-semibold text-fg">{r.categoryName}</strong> spending rose {r.pct}% vs. last month — worth a look.</>;
    default:
      return null;
  }
}

function AIMonthlyReportTab() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    aiApi.monthlyReport().then(setReport).catch(() => setReport(null));
  }, []);

  if (!report) return <p className="text-sm text-muted">Generating report…</p>;

  return (
    <div id="ai-report-print" className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500"><Sparkles size={18} /></span>
          <div>
            <h3 className="font-display text-base font-semibold text-fg">Monthly AI Report</h3>
            <p className="text-xs text-muted">{report.month}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Income" value={formatCurrency(report.income)} tone="lime" icon={<TrendingUp size={18} />} />
        <KpiCard label="Expense" value={formatCurrency(report.expense)} tone="rose" icon={<TrendingDown size={18} />} />
        <KpiCard label="Savings" value={formatCurrency(report.savings)} tone="brand" icon={<PiggyBank size={18} />} />
        <KpiCard label="Savings rate" value={`${report.savingsRate.toFixed(1)}%`} tone="cyan" icon={<Percent size={18} />} />
      </div>

      {report.largestCategory && (
        <Card padding="lg">
          <CardHeader title="Largest spending category" />
          <p className="text-sm text-muted">
            <strong className="font-semibold text-fg">{report.largestCategory.categoryName}</strong> — {formatCurrency(report.largestCategory.amount)}
          </p>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Achievements" right={<Trophy size={16} className="text-subtle" />} />
          {report.achievements.length ? (
            <ul className="space-y-3">
              {report.achievements.map((a, i) => (
                <li key={i} className="text-sm text-muted">{achievementText(a)}</li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing to highlight yet" body="Keep logging transactions and setting budgets to unlock achievements." />
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Recommendations" right={<Lightbulb size={16} className="text-subtle" />} />
          {report.recommendations.length ? (
            <ul className="space-y-3">
              {report.recommendations.map((r, i) => (
                <li key={i} className="text-sm text-muted">{recommendationText(r)}</li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing to flag" body="No pace warnings or savings opportunities this month — nice work." />
          )}
        </Card>
      </div>
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    reportsApi.get().then(setData);
  }, []);

  if (!data) return <p className="text-sm text-muted">Loading reports…</p>;

  const { totals, savings, savingsRate, spendingTrend, categorySpend, topVendors } = data;

  function exportCsv() {
    const trendCsv = toCSV(spendingTrend, [
      { header: 'Month', value: (r) => r.month },
      { header: 'Income', value: (r) => r.income },
      { header: 'Expense', value: (r) => r.expense },
    ]);
    const categoryCsv = toCSV(categorySpend, [
      { header: 'Category', value: (r) => r.name },
      { header: 'Amount', value: (r) => r.amount },
    ]);
    downloadCSV(`report-trend-${new Date().toISOString().slice(0, 10)}.csv`, trendCsv);
    downloadCSV(`report-categories-${new Date().toISOString().slice(0, 10)}.csv`, categoryCsv);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total income" value={formatCurrency(totals.income)} tone="lime" icon={<TrendingUp size={18} />} />
        <KpiCard label="Total expense" value={formatCurrency(totals.expense)} tone="rose" icon={<TrendingDown size={18} />} />
        <KpiCard label="Net savings" value={formatCurrency(savings)} tone="brand" icon={<PiggyBank size={18} />} />
        <KpiCard label="Savings rate" value={`${savingsRate.toFixed(1)}%`} tone="cyan" icon={<Percent size={18} />} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 rounded-xl border border-line bg-surface-2 p-1">
          {TABS.map((t) => (
            <button
              key={t.value} onClick={() => setTab(t.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t.value ? 'bg-brand-500 text-white shadow-glow' : 'text-muted hover:text-fg'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={exportCsv}>Export CSV</Button>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Card padding="lg" className="xl:col-span-2">
            <CardHeader title="Cash flow · Monthly" subtitle="Last 7 months" />
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spendingTrend} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} width={0} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader title="Category share" />
            <div className="mx-auto h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categorySpend} dataKey="amount" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={2}>
                    {categorySpend.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip content={<CategoryTip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {categorySpend.slice(0, 6).map((c) => (
                <div key={c.categoryId} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} /> {c.name}</span>
                  <span className="font-medium text-fg">{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding="lg" className="xl:col-span-3">
            <CardHeader title="Top payees" />
            <div className="space-y-3">
              {topVendors.map((v) => {
                const max = topVendors[0]?.amount || 1;
                return (
                  <div key={v.vendor}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">{v.vendor}</span>
                      <span className="font-semibold text-fg">{formatCurrency(v.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-tint/[0.07]">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${(v.amount / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'category' && (
        <Card padding="lg">
          <CardHeader title="By category" />
          <div style={{ height: Math.max(300, categorySpend.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categorySpend} layout="vertical" margin={{ left: 24, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="amount" name="Amount" radius={[0, 6, 6, 0]}>
                  {categorySpend.map((c, i) => <Cell key={i} fill={c.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {tab === 'trends' && (
        <Card padding="lg">
          <CardHeader title="Monthly comparison" subtitle="Income vs. expense" />
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={spendingTrend} margin={{ left: -20, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} width={0} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="income" name="Income" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {tab === 'ai-report' && <AIMonthlyReportTab />}
    </div>
  );
}
