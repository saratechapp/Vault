import { useTheme } from '../../context/ThemeContext.jsx';
import { formatCurrency } from '../../lib/api.js';

export function ChartTip({ active, label, payload }) {
  const { isDark } = useTheme();
  if (!active || !payload?.length) return null;
  const bg = isDark ? '#111334' : '#ffffff';
  const border = isDark ? '#3a4080' : '#e2e8f0';
  const text = isDark ? '#eef0fb' : '#0f172a';
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, color: text }} className="rounded-xl px-3 py-2 text-xs shadow-soft">
      {label && <p className="mb-1 font-semibold">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          <span style={{ color: isDark ? '#a3a9d4' : '#475569' }}>{p.name}:</span>{' '}
          <span className="font-medium tabular-nums">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function CategoryTip({ active, payload }) {
  const { isDark } = useTheme();
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const bg = isDark ? '#111334' : '#ffffff';
  const border = isDark ? '#3a4080' : '#e2e8f0';
  const text = isDark ? '#eef0fb' : '#0f172a';
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, color: text }} className="rounded-xl px-3 py-2 text-xs shadow-soft">
      <p className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.color }} />
        <span className="font-semibold">{p.name}</span>
      </p>
      <p className="mt-0.5 font-medium tabular-nums">{formatCurrency(p.value)}</p>
    </div>
  );
}

export default ChartTip;
