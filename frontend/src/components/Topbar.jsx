import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Plus, ShieldCheck, ChevronDown, Menu } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNewTransaction, useTxCreatedListener } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { notificationsApi } from '../lib/api.js';
import { Avatar, Button } from './ui/index.js';
import { NoAccountsTooltip } from './NoAccountsTooltip.jsx';
import { ProfileDrawer } from './ProfileDrawer.jsx';
import { SUBSCRIPTION_STATUS, daysRemaining } from '../lib/subscription.js';

const TITLES = {
  '/app/dashboard': { title: 'Dashboard', sub: 'Your financial pulse at a glance.' },
  '/app/accounts': { title: 'Accounts', sub: 'All the places your money lives.' },
  '/app/transactions': { title: 'Transactions', sub: 'Every rupee, tracked and searchable.' },
  '/app/calendar': { title: 'Calendar', sub: 'Browse your financial history by day, week or month.' },
  '/app/budgets': { title: 'Budgets', sub: 'Stay on track, category by category.' },
  '/app/bills': { title: 'Recurring & Bills', sub: 'Track due dates and mark bills paid.' },
  '/app/goals': { title: 'Savings goals', sub: 'Small steps, big wins.' },
  '/app/debts': { title: 'Debts', sub: 'Plan your payoff, minimize interest.' },
  '/app/reports': { title: 'Reports', sub: 'Insights on how you actually spend.' },
  '/app/notifications': { title: 'Notifications', sub: 'Everything worth your attention.' },
  '/app/settings': { title: 'Settings', sub: 'Tune your account and preferences.' },
  '/app/subscription': { title: 'Subscription', sub: 'Your plan and free-trial status.' },
};

// Compact trial/expiry indicator shown next to the profile chip. Recomputed
// from the ISO end date on every render — never a stored number.
function TrialIndicator({ subscription }) {
  if (!subscription) return null;
  if (subscription.status === SUBSCRIPTION_STATUS.FREE_TRIAL) {
    const left = daysRemaining(subscription.trialEndDate);
    return (
      <span className="hidden items-center rounded-lg border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-[11px] font-semibold text-brand-500 sm:inline-flex">
        {left}d left
      </span>
    );
  }
  if (subscription.status === SUBSCRIPTION_STATUS.EXPIRED) {
    return (
      <span className="hidden items-center rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-500 sm:inline-flex">
        Trial ended
      </span>
    );
  }
  return null;
}

export function Topbar({ onMenuClick }) {
  const location = useLocation();
  const { user } = useAuth();
  const { open } = useNewTransaction();
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();
  const [unread, setUnread] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

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
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-app/70 px-4 py-4 backdrop-blur-xl sm:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-tint/[0.08] hover:text-fg md:hidden"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <p className="hidden text-xs text-subtle sm:block">Workspace · / · {title}</p>
          <h1 className="truncate font-display text-xl font-bold text-fg sm:mt-0.5 sm:text-2xl">{title}</h1>
          {sub && <p className="hidden text-sm text-muted sm:block">{sub}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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
            aria-label="New transaction"
            className={accountsLoaded && !hasAccounts ? 'opacity-60' : ''}
          >
            <span className="hidden sm:inline">New transaction</span>
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
        <TrialIndicator subscription={user?.subscription} />
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          aria-label="Open profile"
          aria-haspopup="dialog"
          className="flex items-center gap-2 rounded-xl border border-line bg-tint/[0.05] p-1.5 transition hover:bg-tint/[0.08] sm:pr-2.5"
        >
          <Avatar src={user?.avatar} name={user?.name} className="h-7 w-7 rounded-lg text-[10px]" />
          <div className="hidden leading-tight text-left sm:block">
            <p className="text-xs font-semibold text-fg">{user?.name}</p>
            <p className="truncate text-[10px] text-muted">{user?.email}</p>
          </div>
          <ChevronDown size={16} className="hidden shrink-0 text-muted sm:block" />
        </button>
      </div>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}

export default Topbar;
