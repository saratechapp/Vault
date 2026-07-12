
const TONES = {
  neutral: 'text-muted',
  brand: 'text-brand-500 border-brand-500/30 bg-brand-500/10',
  success: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10',
  danger: 'text-rose-500 border-rose-500/30 bg-rose-500/10',
  warning: 'text-amber-500 border-amber-500/30 bg-amber-500/10',
  info: 'text-cyan-500 border-cyan-500/30 bg-cyan-500/10',
};

export function Chip({ tone = 'neutral', leftIcon = null, children, style, className = '' }) {
  return (
    <span className={`chip ${TONES[tone] || TONES.neutral} ${className}`} style={style}>
      {leftIcon}
      {children}
    </span>
  );
}

export default Chip;
