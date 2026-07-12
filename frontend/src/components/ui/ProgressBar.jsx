
const SIZES = { xs: 'h-1', sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
const TONES = {
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-cyan-500',
};

export function ProgressBar({ value = 0, max = 100, size = 'md', tone, color, className = '' }) {
  const pct = Math.min(100, Math.max(0, (Number(value) / (Number(max) || 100)) * 100));
  const autoTone = pct >= 90 ? 'danger' : pct >= 75 ? 'warning' : 'brand';
  const barClass = color ? '' : TONES[tone || autoTone];
  return (
    <div className={`w-full overflow-hidden rounded-full bg-tint/[0.07] ${SIZES[size] || SIZES.md} ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${barClass}`}
        style={{
          width: `${pct}%`,
          ...(color ? { background: `linear-gradient(90deg, ${color}, ${color}e6)` } : {}),
        }}
      />
    </div>
  );
}

export default ProgressBar;
