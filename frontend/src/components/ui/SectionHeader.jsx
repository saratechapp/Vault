
export function SectionHeader({ eyebrow, title, subtitle, align = 'left' }) {
  const alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start';
  return (
    <div className={`flex flex-col gap-2 ${alignClass}`}>
      {eyebrow && <span className="chip border-brand-500/30 bg-brand-500/10 text-xs font-semibold text-brand-500">{eyebrow}</span>}
      {title && <h2 className="font-display text-2xl font-bold text-fg sm:text-3xl">{title}</h2>}
      {subtitle && <p className="max-w-2xl text-muted">{subtitle}</p>}
    </div>
  );
}

export default SectionHeader;
