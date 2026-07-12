import { motion } from 'framer-motion';

// Simple controlled tabs with a sliding active-pill indicator.
// <Tabs value={tab} onChange={setTab} items={[{value:'a', label:'A'}, ...]} />
export function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-xl border border-line bg-tint/[0.03] p-1 ${className}`}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${active ? 'text-white' : 'text-muted hover:text-fg'}`}
          >
            {active && (
              <motion.span
                layoutId="tabs-active-pill"
                className="absolute inset-0 rounded-lg bg-brand-500"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
