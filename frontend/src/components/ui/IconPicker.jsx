import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Search } from 'lucide-react';
import { ICON_GROUPS } from '../../lib/categoryIcons.js';

export function DynamicIcon({ name, size = 18, ...rest }) {
  const Cmp = LucideIcons[name] || LucideIcons.Circle;
  return <Cmp size={size} {...rest} />;
}

export function IconPicker({ value, onChange, color = '#6366f1' }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  return (
    <div>
      <div className="relative mb-3">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search icons…"
          className="input pl-9 text-sm"
        />
      </div>
      <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
        {ICON_GROUPS.map(({ group, icons }) => {
          const filtered = needle ? icons.filter((n) => n.toLowerCase().includes(needle)) : icons;
          if (!filtered.length) return null;
          return (
            <div key={group}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">{group}</p>
              <div className="grid grid-cols-8 gap-1.5">
                {filtered.map((name) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => onChange(name)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                      value === name ? 'border-transparent text-white' : 'border-line text-muted hover:bg-tint/[0.06]'
                    }`}
                    style={value === name ? { background: color } : undefined}
                  >
                    <DynamicIcon name={name} size={16} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default IconPicker;
