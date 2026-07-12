import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Plus, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNewTransaction, useTxCreatedListener } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { notificationsApi } from '../lib/api.js';
import { Avatar, Button } from './ui/index.js';
import { NoAccountsTooltip } from './NoAccountsTooltip.jsx';

const TITLES = {
  '/app/dashboard': { title: 'Dashboard', sub: 'Your financial pulse at a glance.' },
  '/app/accounts': { title: 'Accounts', sub: 'All the places your money lives.' },
  '/app/transactions': { title: 'Transactions', sub: 'Every rupee, tracked and searchable.' },
  '/app/calendar': { title: 'Calendar', sub: 'Browse your financial history by day, week or month.' },
  '/app/budgets': { title: 'Budgets', sub: 'Stay on track, category by category.' },
  '/app/bills': { title: 'Recurring & Bills', sub: 'Reminders plus auto-posted subscriptions.' },
  '/app/goals': { title: 'Savings goals', sub: 'Small steps, big wins.' },
  '/app/debts': { title: 'Debts', sub: 'Plan your payoff, minimize interest.' },
  '/app/reports': { title: 'Reports', sub: 'Insights on how you actually spend.' },
  '/app/notifications': { title: 'Notifications', sub: 'Everything worth your attention.' },
  '/app/settings': { title: 'Settings', sub: 'Tune your account and preferences.' },
};

export function Topbar() {
  const location = useLocation();
  const { user } = useAuth();
  const { open } = useNewTransaction();
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();
  const [unread, setUnread] = useState(0);

  async function loadUnread() {
    try {
      const list = await notificationsApi.list();
      setUnread((list || []).filter((n) => !n.read).length);
    } catch {
      // best-effort
    }
  }

  useEffect(() => {
    loadUnread();
  }, [location.pathname]);
  useTxCreatedListener(loadUnread);

  const { title, sub } = TITLES[location.pathname]
    || (location.pathname.startsWith('/app/accounts/') ? { title: 'Account details', sub: 'A closer look at one account.' } : null)
    || { title: 'Vault', sub: '' };
  const bellTitle = unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-app/70 px-8 py-4 backdrop-blur-xl">
      <div>
        <p className="text-xs text-subtle">Workspace · / · {title}</p>
        <h1 className="mt-0.5 font-display text-2xl font-bold text-fg">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ThemeToggle />
        <Link
          to="/app/notifications"
          title={bellTitle}
          aria-label={bellTitle}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-tint/[0.05] text-muted transition hover:bg-tint/[0.08] hover:text-fg"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Link>
        <NoAccountsTooltip blocked={accountsLoaded && !hasAccounts}>
          <Button
            data-tour="new-transaction-btn"
            leftIcon={<Plus size={16} />}
            onClick={accountsLoaded && !hasAccounts ? undefined : open}
            aria-disabled={accountsLoaded && !hasAccounts}
            className={accountsLoaded && !hasAccounts ? 'opacity-60' : ''}
          >
            New transaction
          </Button>
        </NoAccountsTooltip>
        {user?.isAdmin && (
          <Button
            variant="outline"
            leftIcon={<ShieldCheck size={16} />}
            onClick={() => window.open('/superadmin/', '_blank', 'noopener')}
          >
            Super Admin
          </Button>
        )}
        <div className="flex items-center gap-2 rounded-xl border border-line bg-tint/[0.05] py-1.5 pl-1.5 pr-3">
          <Avatar src={user?.avatar} name={user?.name} className="h-7 w-7 rounded-lg text-[10px]" />
          <div className="leading-tight">
            <p className="text-xs font-semibold text-fg">{user?.name}</p>
            <p className="truncate text-[10px] text-muted">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;
