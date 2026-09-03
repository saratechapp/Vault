import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Wallet, Receipt,
  Target, TrendingDown, PieChart, Bell, Settings2, LogOut, CalendarDays, MessageSquareHeart,
} from 'lucide-react';
import { Avatar } from './ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { accountsApi, transactionsApi, billsApi, notificationsApi } from '../lib/api.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';

export const NAV = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/accounts', label: 'Accounts', icon: CreditCard, badgeKey: 'accounts' },
  { to: '/app/transactions', label: 'Transactions', icon: ArrowLeftRight, badgeKey: 'transactions' },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/budgets', label: 'Budgets', icon: Wallet },
  { to: '/app/bills', label: 'Recurring & Bills', icon: Receipt, badgeKey: 'bills' },
  { to: '/app/goals', label: 'Savings goals', icon: Target },
  { to: '/app/debts', label: 'Debts', icon: TrendingDown },
  { to: '/app/reports', label: 'Reports', icon: PieChart },
  { to: '/app/notifications', label: 'Notifications', icon: Bell, badgeKey: 'notifications', urgent: true },
  { to: '/app/feedback', label: 'Feedback', icon: MessageSquareHeart },
  { to: '/app/settings', label: 'Settings', icon: Settings2 },
];

function formatBadge(n) {
  return n > 99 ? '99+' : n;
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const [badges, setBadges] = useState({});

  async function loadBadges() {
    try {
      const [accounts, transactions, bills, notifications] = await Promise.all([
        accountsApi.list(), transactionsApi.list(), billsApi.list(), notificationsApi.list(),
      ]);
      setBadges({
        accounts: accounts?.length || 0,
        transactions: transactions?.length || 0,
        bills: (bills || []).filter((b) => b.status === 'pending').length,
        notifications: (notifications || []).filter((n) => !n.read).length,
      });
    } catch {
      // sidebar badges are best-effort
    }
  }

  useEffect(() => {
    loadBadges();
  }, []);
  useTxCreatedListener(loadBadges);

  return (
    <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col border-r border-line bg-app/70 px-4 py-6 backdrop-blur-xl md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <img src="/logo.svg" alt="Vault" className="h-9 w-9 rounded-xl shadow-glow" />
        <div>
          <p className="font-display text-base font-bold leading-none text-fg">Vault</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-subtle">Personal Finance</p>
        </div>
      </div>

      <p className="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-widest text-subtle">Workspace</p>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon, badgeKey, urgent }) => {
          const count = badgeKey ? badges[badgeKey] : 0;
          return (
            <NavLink
              key={to}
              to={to}
              data-tour={to === '/app/accounts' ? 'sidebar-accounts' : undefined}
              className={({ isActive }) =>
                `relative flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-tint/10 text-fg' : 'text-muted hover:bg-tint/[0.04] hover:text-fg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-gradient-to-b from-brand-400 to-accent-purple" />
                  )}
                  <span className="flex items-center gap-2.5">
                    <Icon size={18} />
                    {label}
                  </span>
                  {!!count && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        urgent ? 'bg-rose-500/15 text-rose-500' : 'bg-tint/[0.08] text-subtle'
                      }`}
                    >
                      {formatBadge(count)}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="divider my-3" />

      <div className="flex items-center gap-2.5 px-1">
        <Avatar src={user?.avatar} name={user?.name} className="h-9 w-9 shrink-0 rounded-full ring-2 ring-line-strong text-xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{user?.name}</p>
          <p className="truncate text-xs text-muted">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
