import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { X, LogOut } from 'lucide-react';
import { NAV } from './Sidebar.jsx';
import { Avatar } from './ui/index.js';
import { useAuth } from '../context/AuthContext.jsx';

// Slide-in navigation for viewports below `md`, where the fixed Sidebar is
// hidden. Same NAV list as the desktop sidebar (imported, not duplicated).
export function MobileNav({ open, onClose }) {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 md:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`absolute left-0 top-0 flex h-full w-[280px] max-w-[85vw] flex-col border-r border-line bg-app px-4 py-5 shadow-xl transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
        role="dialog"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Vault" className="h-8 w-8 rounded-xl" />
            <span className="font-display text-base font-bold text-fg">Vault</span>
          </div>
          <button type="button" onClick={onClose} aria-label="Close navigation" className="rounded-lg p-2 text-muted hover:bg-tint/[0.06] hover:text-fg">
            <X size={18} />
          </button>
        </div>

        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-tint/10 text-fg' : 'text-muted hover:bg-tint/[0.04] hover:text-fg'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-3 flex items-center gap-2.5 border-t border-line px-1 pt-3">
          <Avatar src={user?.avatar} name={user?.name} className="h-9 w-9 shrink-0 rounded-full text-xs" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-fg">{user?.name}</p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => { onClose(); logout(); }}
            aria-label="Sign out"
            className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-rose-500/10 hover:text-rose-500"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </div>
  );
}

export default MobileNav;
