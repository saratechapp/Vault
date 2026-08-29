import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, User, Bell, MessageSquareHeart, LifeBuoy, LogOut, ChevronRight, Sun, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { subscriptionApi } from '../lib/api.js';
import { Avatar } from './ui/index.js';
import { SubscriptionCard } from './SubscriptionCard.jsx';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

// "ferraalexandra" style handle from the display name, falling back to the
// email local-part.
function handleFrom(user) {
  const base = (user?.name || '').trim() || (user?.email || '').split('@')[0] || '';
  return base.toLowerCase().replace(/[^a-z0-9._-]+/g, '');
}

function SectionLabel({ children }) {
  return (
    <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-wide text-subtle">{children}</p>
  );
}

function MenuRow({ icon, label, sub, danger = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-1 py-2.5 text-left transition ${
        danger ? 'hover:bg-rose-500/10' : 'hover:bg-tint/[0.06]'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          danger ? 'bg-rose-500/10 text-rose-500' : 'bg-tint/[0.07] text-muted'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${danger ? 'text-rose-500' : 'text-fg'}`}>{label}</span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
      {!danger && <ChevronRight size={16} className="shrink-0 text-subtle" />}
    </button>
  );
}

// Two-segment pill control matching the reference's Appearance switch. This
// app's theme is deliberately binary (light/dark), so there is no "Auto".
function AppearanceControl() {
  const { isDark, setTheme } = useTheme();
  const options = [
    { key: 'light', label: 'Light', icon: Sun },
    { key: 'dark', label: 'Dark', icon: Moon },
  ];
  const active = isDark ? 'dark' : 'light';
  return (
    <div className="flex gap-1 rounded-xl bg-tint/[0.06] p-1">
      {options.map(({ key, label, icon: Icon }) => {
        const selected = active === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setTheme(key)}
            aria-pressed={selected}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
              selected ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function ProfileDrawer({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [subscription, setSubscription] = useState(user?.subscription || null);

  useEffect(() => {
    setSubscription(user?.subscription || null);
  }, [user?.subscription]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    subscriptionApi
      .get()
      .then((fresh) => {
        if (!cancelled && fresh) setSubscription(fresh);
      })
      .catch(() => {
        // best-effort — the /api/me copy already rendered
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  function go(path) {
    onClose?.();
    navigate(path);
  }

  async function handleLogout() {
    onClose?.();
    await logout();
  }

  const handle = handleFrom(user);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="profile-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            key="profile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Your profile"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-xl ${
              isMobile ? '' : 'sm:max-w-[400px] sm:border-l sm:border-line-strong'
            }`}
          >
            {/* Header */}
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar src={user?.avatar} name={user?.name} className="h-11 w-11 rounded-full text-sm" />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold text-fg">{user?.name || 'Your account'}</p>
                  <p className="truncate text-xs text-muted">
                    {handle}
                    {user?.email ? ` · ${user.email}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1.5 rounded-lg p-1.5 text-muted transition hover:bg-tint/[0.06] hover:text-fg"
              >
                <X size={18} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5">
              <SubscriptionCard subscription={subscription} onNavigate={onClose} />

              <div className="mt-6">
                <SectionLabel>Appearance</SectionLabel>
                <AppearanceControl />
              </div>

              <div className="mt-5">
                <MenuRow
                  icon={<User size={16} />}
                  label="My account"
                  sub={handle}
                  onClick={() => go('/app/settings')}
                />
                <MenuRow icon={<Bell size={16} />} label="Notifications" onClick={() => go('/app/notifications')} />
                <MenuRow
                  icon={<MessageSquareHeart size={16} />}
                  label="Feedback"
                  onClick={() => go('/app/feedback')}
                />
                <MenuRow icon={<LifeBuoy size={16} />} label="Help & support" onClick={() => go('/app/feedback')} />
              </div>

              <div className="divider my-4" />

              <MenuRow icon={<LogOut size={16} />} label="Log out" danger onClick={handleLogout} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default ProfileDrawer;
