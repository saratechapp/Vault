import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Sparkles, Bell, Wallet, PiggyBank, CreditCard } from 'lucide-react';
import { Card, ProgressBar, Chip } from './ui/index.js';

// Realistic mock data for the landing page's "live product" preview — not a
// static image (no image-gen tool available here), but a real render of the
// app's actual design system, which keeps it perfectly in sync visually and
// is arguably more honest than a doctored screenshot. USD, per the redesign
// spec, distinct from the real (multi-currency, user-preference-driven) app.
const TREND = [
  { month: 'Jul', net: 1840 }, { month: 'Aug', net: 2210 }, { month: 'Sep', net: 1960 },
  { month: 'Oct', net: 2680 }, { month: 'Nov', net: 2340 }, { month: 'Dec', net: 3120 }, { month: 'Jan', net: 2860 },
];
const ACCOUNTS = [
  { name: 'Checking', icon: Wallet, balance: 12450.32, color: 'text-brand-500 bg-brand-500/15' },
  { name: 'Savings', icon: PiggyBank, balance: 28900.0, color: 'text-success bg-success/15' },
  { name: 'Credit Card', icon: CreditCard, balance: -1542.18, color: 'text-danger bg-danger/15' },
];
const TRANSACTIONS = [
  { vendor: 'Whole Foods Market', category: 'Groceries', amount: -84.21, date: 'Today' },
  { vendor: 'Paycheck · Acme Corp', category: 'Income', amount: 4100.0, date: 'Yesterday' },
  { vendor: 'Spotify Premium', category: 'Subscriptions', amount: -10.99, date: 'Yesterday' },
  { vendor: 'Amazon', category: 'Shopping', amount: -156.32, date: '2 days ago' },
];
const BUDGETS = [
  { name: 'Dining out', spent: 420, limit: 500 },
  { name: 'Groceries', spent: 380, limit: 600 },
  { name: 'Entertainment', spent: 95, limit: 150 },
];

const usd = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-fg">{label}</p>
      <p className="text-muted">Net: {usd(payload[0].value)}</p>
    </div>
  );
}

export function LandingDashboardPreview() {
  return (
    <Card strong padding="none" className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-danger" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning" />
        <span className="h-2.5 w-2.5 rounded-full bg-success" />
        <span className="ml-3 rounded-md bg-tint/[0.05] px-3 py-1 text-xs text-subtle">app.vault.finance/dashboard</span>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.3fr_1fr] lg:p-6">
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-line p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Total balance</p>
              <p className="mt-1 font-display text-lg font-bold text-fg sm:text-xl">$39,808</p>
              <p className="mt-1 flex items-center gap-0.5 text-xs font-semibold text-success"><ArrowUpRight size={12} /> 8.2%</p>
            </div>
            <div className="rounded-xl border border-line p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">This month spent</p>
              <p className="mt-1 font-display text-lg font-bold text-fg sm:text-xl">$5,340</p>
              <p className="mt-1 flex items-center gap-0.5 text-xs font-semibold text-danger"><ArrowDownRight size={12} /> 4.1%</p>
            </div>
            <div className="rounded-xl border border-line p-3.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">Savings rate</p>
              <p className="mt-1 font-display text-lg font-bold text-fg sm:text-xl">34.9%</p>
              <p className="mt-1 flex items-center gap-0.5 text-xs font-semibold text-success"><ArrowUpRight size={12} /> 2.6pt</p>
            </div>
          </div>

          {/* Trend chart */}
          <div className="rounded-xl border border-line p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-subtle">Cash flow · Last 7 months</p>
              <Chip tone="success">+$2,860 this month</Chip>
            </div>
            <div className="mt-2 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={TREND} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="landingTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7F3AEF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#7F3AEF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-subtle" axisLine={false} tickLine={false} />
                  <Tooltip content={<TrendTooltip />} />
                  <Area type="monotone" dataKey="net" stroke="#7F3AEF" strokeWidth={2.5} fill="url(#landingTrend)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Accounts */}
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-semibold text-subtle">Accounts</p>
            <div className="mt-3 space-y-2.5">
              {ACCOUNTS.map((a) => (
                <div key={a.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${a.color}`}><a.icon size={14} /></span>
                    <span className="text-sm text-fg">{a.name}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-fg">{usd(a.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {/* AI insight */}
          <motion.div
            className="rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-4"
            animate={{ opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="flex items-center gap-2 text-brand-500">
              <Sparkles size={14} />
              <span className="text-xs font-semibold">AI insight</span>
            </div>
            <p className="mt-2 text-sm text-muted">Dining spend is up 23% vs. last month — mostly weekday lunches. Set a $450 cap to stay on pace.</p>
          </motion.div>

          {/* Budgets */}
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-semibold text-subtle">Budgets</p>
            <div className="mt-3 space-y-3">
              {BUDGETS.map((b) => (
                <div key={b.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">{b.name}</span>
                    <span className="font-semibold text-fg">{usd(b.spent)} / {usd(b.limit)}</span>
                  </div>
                  <ProgressBar value={(b.spent / b.limit) * 100} size="xs" className="mt-1.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions */}
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-semibold text-subtle">Recent transactions</p>
            <div className="mt-3 space-y-2.5">
              {TRANSACTIONS.map((t) => (
                <div key={t.vendor} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">{t.vendor}</p>
                    <p className="text-xs text-subtle">{t.category} · {t.date}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.amount > 0 ? 'text-success' : 'text-fg'}`}>
                    {t.amount > 0 ? '+' : ''}{usd(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notification */}
          <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.06] p-3.5">
            <Bell size={15} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-xs text-muted"><span className="font-semibold text-fg">Netflix</span> renews in 2 days — $15.49</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default LandingDashboardPreview;
