import { ArrowRight, ArrowUpRight, ArrowDownRight, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * GlowCard — the Dashboard AccountPill style, extracted for reuse.
 *
 * Props:
 *   href       — where clicking the card takes you (optional)
 *   color      — accent hex for the halos, dot, and ghost icon
 *   Icon       — a lucide icon component
 *   title      — small header text
 *   value      — the big number/string (auto rose if `negative` is true)
 *   subtitle   — small uppercase footer text
 *   negative   — flips the value color to rose
 *   width      — override the 240px default (Tailwind class, e.g. "w-full")
 *   trend      — { direction: 'up'|'down'|'flat', label: string } — optional ↑/↓ badge vs last month
 *   pinned     — whether this card is pinned (shows a filled pin)
 *   onTogglePin — if provided, renders a pin toggle button in the top-right corner
 *   isPrimary  — shows a small "Primary" pill next to the title
 */
export function GlowCard({
  href, color = '#6366f1', Icon, title, value, subtitle,
  negative = false, width = 'w-[240px]', trend = null, pinned = false, onTogglePin, isPrimary = false,
}) {
  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`group glass relative block ${width} shrink-0 overflow-hidden rounded-2xl px-5 py-4 transition hover:-translate-y-0.5 hover:border-line-strong`}
    >
      <div
        className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full blur-2xl opacity-60"
        style={{ background: color }}
      />
      <div
        className="pointer-events-none absolute -right-10 -bottom-12 h-28 w-28 rounded-full blur-2xl opacity-30"
        style={{ background: color }}
      />
      {Icon && (
        <Icon
          size={70}
          className="pointer-events-none absolute -right-3 -bottom-3 opacity-[0.07]"
          style={{ color }}
        />
      )}

      <div className="relative flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          />
          <div className="truncate text-xs font-medium text-fg/80">{title}</div>
          {isPrimary && (
            <span className="shrink-0 rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand-500">Primary</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onTogglePin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin();
              }}
              title={pinned ? 'Unpin' : 'Pin to keep first'}
              className={`rounded-lg p-1 transition ${pinned ? 'text-brand-500' : 'text-muted opacity-0 group-hover:opacity-100'}`}
            >
              <Pin size={12} className={pinned ? 'fill-current' : ''} />
            </button>
          )}
          {href && <ArrowRight size={14} className="text-muted opacity-0 transition group-hover:opacity-100" />}
        </div>
      </div>

      <div className={`relative mt-3 font-display text-2xl font-bold ${negative ? 'text-rose-500 dark:text-rose-300' : 'text-fg'}`}>
        {value}
      </div>
      <div className="relative mt-0.5 flex items-center justify-between gap-2">
        {subtitle && <div className="truncate text-[10px] uppercase tracking-wider text-subtle">{subtitle}</div>}
        {trend && trend.direction !== 'flat' && (
          <span className={`flex shrink-0 items-center gap-0.5 text-[10px] font-semibold ${trend.direction === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend.direction === 'up' ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend.label}
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export default GlowCard;
