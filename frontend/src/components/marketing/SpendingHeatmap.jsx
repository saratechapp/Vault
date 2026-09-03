import { motion, useReducedMotion } from 'framer-motion';

// A calendar heatmap of daily spend intensity — the same shape the in-app
// Calendar view draws from real transaction data. The values here are a fixed
// illustrative pattern for the marketing page (heavier on weekends), not a
// live feed. Levels 0–4 map to increasing brand-tinted fills.
const WEEKS = 16;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Deterministic pseudo-pattern so the grid looks organic but never shifts.
// Blends two out-of-phase waves (so no run of empty weeks), a weekend bump and
// a payday-week dip, then quantises to 0–4.
function levelFor(day, week) {
  const w1 = Math.sin(week * 0.7 + day * 0.9);
  const w2 = Math.cos(week * 0.33 - day * 0.5);
  const base = (w1 * 0.5 + w2 * 0.5) * 0.5 + 0.5; // 0..1
  const weekend = day >= 5 ? 0.28 : 0;
  const paydayDip = week % 4 === 3 ? -0.18 : 0;
  const raw = Math.min(1, Math.max(0, base * 0.85 + 0.18 + weekend + paydayDip));
  return Math.round(raw * 4);
}

const FILL = [
  'bg-tint/[0.05]',
  'bg-brand-500/20',
  'bg-brand-500/40',
  'bg-brand-500/65',
  'bg-brand-500/90',
];

export function SpendingHeatmap({ className = '' }) {
  const reduce = useReducedMotion();

  return (
    <div className={className}>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {Array.from({ length: WEEKS }).map((_, week) => (
          <div key={week} className="flex flex-col gap-1.5">
            {DAYS.map((_, day) => {
              const lvl = levelFor(day, week);
              return (
                <motion.span
                  key={day}
                  className={`h-3.5 w-3.5 rounded-[3px] ${FILL[lvl]}`}
                  initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                  whileInView={reduce ? undefined : { opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: Math.min(0.5, (week * 7 + day) * 0.006), ease: [0.16, 1, 0.3, 1] }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-subtle">
        <span>Less</span>
        {FILL.map((f, i) => (
          <span key={i} className={`h-3 w-3 rounded-[3px] ${f}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

export default SpendingHeatmap;
