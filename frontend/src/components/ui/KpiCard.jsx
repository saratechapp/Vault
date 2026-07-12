import { Card } from './Card.jsx';

const TONES = {
  brand: 'bg-brand-500/15 text-brand-500',
  lime: 'bg-accent-lime/15 text-accent-lime',
  rose: 'bg-accent-rose/15 text-accent-rose',
  cyan: 'bg-accent-cyan/15 text-accent-cyan',
  amber: 'bg-accent-amber/15 text-accent-amber',
};

export function KpiCard({ label, value, delta, icon, tone = 'brand', hint, invertDelta = false }) {
  const hasDelta = typeof delta === 'number' && !Number.isNaN(delta);
  const positive = invertDelta ? delta < 0 : delta > 0;
  const deltaColor = !hasDelta ? '' : positive ? 'text-emerald-500' : delta === 0 ? 'text-subtle' : 'text-rose-500';

  return (
    <Card className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{label}</p>
        <p className="mt-1.5 truncate font-display text-2xl font-bold text-fg">{value}</p>
        {hasDelta && (
          <p className={`mt-1 text-xs font-semibold ${deltaColor}`}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}%
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      </div>
      {icon && <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${TONES[tone] || TONES.brand}`}>{icon}</div>}
    </Card>
  );
}

export default KpiCard;
