import { useEffect, useState } from 'react';
import { Wallet, Receipt, PieChart, CalendarClock, Target, ShieldCheck } from 'lucide-react';
import { assistantData } from '../../lib/assistant/dataStore.js';
import { formatCurrency } from '../../lib/api.js';
import { Skeleton } from '../ui/index.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const TONE_BG = {
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-brand-500/15 text-brand-500',
};

function Stat({ icon: Icon, label, value, tone = 'info' }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 px-2.5 py-2">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${TONE_BG[tone]}`}>
        <Icon size={12} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[9px] font-medium uppercase tracking-wide text-subtle">{label}</p>
        <p className="truncate text-xs font-semibold text-fg">{value}</p>
      </div>
    </div>
  );
}

export function WelcomeSnapshot() {
  const [snapshot, setSnapshot] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([assistantData.dashboard(), assistantData.budgets()])
      .then(([dashboard, budgets]) => {
        if (cancelled) return;
        const remainingBudget = (budgets || []).reduce((sum, b) => sum + Math.max(0, (b.limit || 0) - (b.spent || 0)), 0);
        const upcomingBills = dashboard.upcomingBills || [];
        const billsTotal = upcomingBills.reduce((sum, b) => sum + (b.amount || 0), 0);
        const goals = dashboard.goals || [];
        const savedTotal = goals.reduce((sum, g) => sum + (g.saved || 0), 0);
        const targetTotal = goals.reduce((sum, g) => sum + (g.target || 0), 0);
        setSnapshot({
          balance: formatCurrency(dashboard.metrics?.totalBalance || 0),
          monthlySpending: formatCurrency(dashboard.metrics?.monthlyExpense || 0),
          remainingBudget: budgets?.length ? formatCurrency(remainingBudget) : '—',
          upcomingBills: upcomingBills.length ? `${upcomingBills.length} · ${formatCurrency(billsTotal)}` : 'None',
          savingsProgress: targetTotal > 0 ? `${Math.round((savedTotal / targetTotal) * 100)}%` : '—',
          healthScore: dashboard.healthScore != null ? `${dashboard.healthScore} · ${dashboard.healthGrade || '—'}` : '—',
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-2xl border border-line bg-tint/[0.02] p-3">
      <p className="font-display text-sm font-semibold text-fg">{greeting()} 👋</p>
      <p className="mt-0.5 text-xs text-muted">Here's your financial snapshot today.</p>
      {!snapshot ? (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[52px] rounded-xl" />)}
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          <Stat icon={Wallet} label="Balance" value={snapshot.balance} tone="info" />
          <Stat icon={Receipt} label="Spending" value={snapshot.monthlySpending} tone="warning" />
          <Stat icon={PieChart} label="Budget Left" value={snapshot.remainingBudget} tone="info" />
          <Stat icon={CalendarClock} label="Bills Due" value={snapshot.upcomingBills} tone="warning" />
          <Stat icon={Target} label="Savings" value={snapshot.savingsProgress} tone="success" />
          <Stat icon={ShieldCheck} label="Health" value={snapshot.healthScore} tone="success" />
        </div>
      )}
    </div>
  );
}

export default WelcomeSnapshot;
