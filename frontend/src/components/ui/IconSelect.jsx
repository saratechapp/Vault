import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// A Select for pickers whose options each carry their own icon/color (an
// account or a category) — the plain <Select> only ever renders text.
// Originally local to NewTransactionModal.jsx; shared so Bills' and Goals'
// account/category pickers can show the same icon badges instead of a bare
// name. `options` are `{ id, name, parentId? }` plus whatever `renderIcon`
// needs (e.g. `.color`/`.icon`); `renderIcon(option)` returns the badge.
export function IconSelect({ value, options, onChange, placeholder, renderIcon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="input flex items-center justify-between gap-2 text-left">
        <span className="flex min-w-0 items-center gap-2">
          {selected ? renderIcon(selected) : null}
          <span className={`truncate ${selected ? '' : 'text-subtle'}`}>{selected ? selected.name : placeholder}</span>
        </span>
        <ChevronDown size={14} className="shrink-0 text-subtle" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-card">
          {options.length === 0 && <p className="px-2.5 py-2 text-xs text-subtle">Nothing to pick from</p>}
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-lg py-2 text-left text-sm hover:bg-tint/[0.06] ${o.parentId ? 'pl-7 pr-2.5' : 'px-2.5'}`}
            >
              {renderIcon(o)}
              <span className={`truncate ${o.parentId ? 'text-muted' : ''}`}>
                {o.parentId && <span className="mr-1 text-subtle">↳</span>}
                {o.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default IconSelect;
