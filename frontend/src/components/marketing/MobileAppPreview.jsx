import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
  Home, ArrowLeftRight, CalendarDays, PieChart, Sparkles, Plus,
  ArrowUpRight, ArrowDownRight, Utensils, ShoppingBag, Car, Wallet,
} from 'lucide-react';
import { useCurrency } from '../../context/LandingCurrencyContext.jsx';

// A compact render of the mobile app's key screens, built from the same
// design-system tokens as the web app so it stays visually in sync (no
// screenshot to drift). `variant` picks which screen to show inside the
// shared phone shell. Amounts render in the visitor's own detected currency
// (LandingCurrencyContext), same as the desktop preview — this is a
// marketing mockup, not the signed-in app's own data.
const TREND = [
  { v: 18 }, { v: 24 }, { v: 20 }, { v: 30 }, { v: 26 }, { v: 34 }, { v: 31 },
];

const TX = [
  { icon: Utensils, name: 'Blue Tokai', cat: 'Food & Drink', amount: -420 },
  { icon: Wallet, name: 'Salary — June', cat: 'Income', amount: 94000 },
  { icon: ShoppingBag, name: 'Amazon', cat: 'Shopping', amount: -2310 },
  { icon: Car, name: 'Uber', cat: 'Transport', amount: -268 },
];

const TABS = [
  { icon: Home, key: 'dashboard' },
  { icon: ArrowLeftRight, key: 'transactions' },
  { icon: CalendarDays, key: 'calendar' },
  { icon: PieChart, key: 'reports' },
];

function Shell({ title, active, children }) {
  return (
    <div className="flex h-[460px] flex-col bg-app text-fg">
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <div>
          <p className="text-[10px] text-subtle">Good morning</p>
          <p className="text-sm font-bold">{title}</p>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500/15 text-brand-500">
          <Sparkles size={13} />
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden px-4">{children}</div>
      <div className="flex items-center justify-around border-t border-line bg-surface/80 px-2 py-2.5 backdrop-blur dark:bg-surface-2/80">
        {TABS.map((t) => (
          <span
            key={t.key}
            className={`flex h-8 w-8 items-center justify-center rounded-lg ${
              t.key === active ? 'bg-brand-500/15 text-brand-500' : 'text-subtle'
            }`}
          >
            <t.icon size={16} />
          </span>
        ))}
      </div>
    </div>
  );
}

function DashboardScreen() {
  const { formatCurrency } = useCurrency();
  return (
    <Shell title="Dashboard" active="dashboard">
      <div className="rounded-xl border border-line bg-surface p-3.5 dark:bg-surface-2">
        <p className="text-[10px] uppercase tracking-wide text-subtle">Total balance</p>
        <p className="mt-1 font-display text-xl font-bold">{formatCurrency(324860)}</p>
        <p className="mt-0.5 flex items-center gap-0.5 text-[11px] font-semibold text-success">
          <ArrowUpRight size={11} /> 6.4% this month
        </p>
        <div className="mt-2 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={TREND} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mobTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7F3AEF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7F3AEF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="#7F3AEF" strokeWidth={2} fill="url(#mobTrend)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line bg-surface p-2.5 dark:bg-surface-2">
          <p className="text-[10px] text-subtle">Spent</p>
          <p className="text-sm font-bold">{formatCurrency(41200)}</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-2.5 dark:bg-surface-2">
          <p className="text-[10px] text-subtle">Saved</p>
          <p className="text-sm font-bold text-success">{formatCurrency(52800)}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-brand-500/25 bg-brand-500/[0.06] p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-500">
          <Sparkles size={12} /> AI insight
        </p>
        <p className="mt-1 text-[11px] text-muted">Dining is up 23% — a {formatCurrency(6000)} cap keeps June on pace.</p>
      </div>
    </Shell>
  );
}

function TransactionsScreen() {
  const { formatCurrency } = useCurrency();
  return (
    <Shell title="Transactions" active="transactions">
      <div className="space-y-2">
        {TX.map((t) => (
          <div key={t.name} className="flex items-center gap-2 rounded-lg border border-line bg-surface p-2 dark:bg-surface-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-tint/[0.06] text-muted">
              <t.icon size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">{t.name}</p>
              <p className="truncate text-[10px] text-subtle">{t.cat}</p>
            </div>
            <span className={`shrink-0 text-[11px] font-semibold tabular-nums ${t.amount > 0 ? 'text-success' : 'text-fg'}`}>
              {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
            </span>
          </div>
        ))}
      </div>
      <button className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-500/10 py-2 text-xs font-semibold text-brand-500">
        <Plus size={13} /> Add transaction
      </button>
    </Shell>
  );
}

function CalendarScreen() {
  const { formatCurrency } = useCurrency();
  const cells = Array.from({ length: 35 });
  return (
    <Shell title="Calendar" active="calendar">
      <p className="mb-2 text-xs font-semibold text-subtle">September 2026</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[9px] text-subtle">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((_, i) => {
          const lvl = [0, 1, 0, 2, 3, 1, 0, 1, 2, 0, 3, 2, 1, 0][i % 14];
          const fill = ['bg-tint/[0.06]', 'bg-brand-500/25', 'bg-brand-500/50', 'bg-brand-500/80'][lvl];
          return <span key={i} className={`aspect-square rounded-[3px] ${fill}`} />;
        })}
      </div>
      <div className="mt-3 rounded-lg border border-line bg-surface p-3 dark:bg-surface-2">
        <p className="text-[10px] text-subtle">Sep 3 · net</p>
        <p className="flex items-center gap-0.5 text-sm font-bold text-danger">
          <ArrowDownRight size={12} /> {formatCurrency(-1173)}
        </p>
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[9px] text-subtle">
        <span>Less</span>
        {['bg-tint/[0.06]', 'bg-brand-500/25', 'bg-brand-500/50', 'bg-brand-500/80'].map((f, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${f}`} />
        ))}
        <span>More</span>
      </div>
    </Shell>
  );
}

const SCREENS = {
  dashboard: DashboardScreen,
  transactions: TransactionsScreen,
  calendar: CalendarScreen,
};

export function MobileAppPreview({ variant = 'dashboard' }) {
  const Screen = SCREENS[variant] || DashboardScreen;
  return <Screen />;
}

export default MobileAppPreview;
