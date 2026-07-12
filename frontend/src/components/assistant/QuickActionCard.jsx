import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, CreditCard, ArrowLeftRight, Wallet, Receipt, Target, PieChart, ArrowRight,
} from 'lucide-react';
import { useAssistant } from '../../context/AssistantContext.jsx';

// Icon + short description per destination, mirroring the icons already
// chosen for these routes in components/Sidebar.jsx's NAV — kept here in the
// UI layer so handlers.js only has to supply {label, to}.
const DESTINATION_META = {
  '/app/dashboard': { icon: LayoutDashboard, description: 'Your full financial overview' },
  '/app/accounts': { icon: CreditCard, description: 'View and manage your accounts' },
  '/app/transactions': { icon: ArrowLeftRight, description: 'See your latest activity' },
  '/app/budgets': { icon: Wallet, description: 'Track spending limits by category' },
  '/app/bills': { icon: Receipt, description: 'Manage recurring bills & payments' },
  '/app/goals': { icon: Target, description: 'Track your savings goals' },
  '/app/reports': { icon: PieChart, description: 'Deep-dive analytics & trends' },
};

export function QuickActionCard({ label, to }) {
  const meta = DESTINATION_META[to] || { icon: ArrowRight, description: 'Open this page' };
  const Icon = meta.icon;
  // Navigating without closing left the floating card (or, on mobile, the
  // ~88vh bottom sheet) sitting on top of the destination page — the user
  // reported Budgets/Bills as "not visible" after tapping a quick action,
  // which was really every quick action leaving the panel open over the page.
  const { close } = useAssistant();
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}>
      <Link
        to={to}
        onClick={close}
        className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2.5 transition hover:border-line-strong hover:shadow-sm"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{label}</p>
          <p className="truncate text-[11px] text-subtle">{meta.description}</p>
        </div>
        <ArrowRight size={14} className="shrink-0 text-subtle" />
      </Link>
    </motion.div>
  );
}

export default QuickActionCard;
