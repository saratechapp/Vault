import React, { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

export const Input = forwardRef(function Input({ leftIcon, rightSlot, className = '', ...rest }, ref) {
  if (!leftIcon && !rightSlot) {
    return <input ref={ref} className={`input ${className}`} {...rest} />;
  }
  return (
    <div className="relative">
      {leftIcon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">{leftIcon}</span>}
      <input ref={ref} className={`input ${leftIcon ? 'pl-10' : ''} ${rightSlot ? 'pr-10' : ''} ${className}`} {...rest} />
      {rightSlot && <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>}
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', rows = 4, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={`input resize-y ${className}`} {...rest} />;
});

export function Select({ className = '', children, value, onChange, disabled, placeholder }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const options = React.Children.toArray(children)
    .filter((c) => c && c.props)
    .map((c) => ({ value: c.props.value, label: c.props.children, disabled: c.props.disabled }));
  const selected = options.find((o) => o.value === value) ?? options[0];

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return undefined;
    const update = () => {
      const r = triggerRef.current.getBoundingClientRect();
      setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(optionValue) {
    onChange?.({ target: { value: optionValue } });
    setOpen(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`input flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span className={`truncate ${selected ? '' : 'text-subtle'}`}>{selected ? selected.label : placeholder || 'Select…'}</span>
        <ChevronDown size={14} className={`shrink-0 text-subtle transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && rect && createPortal(
        <div
          ref={panelRef}
          style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="z-[100] max-h-56 overflow-y-auto rounded-xl border border-line-strong bg-surface p-1 shadow-card"
        >
          {options.map((o, i) => (
            <button
              key={`${o.value}-${i}`}
              type="button"
              disabled={o.disabled}
              onClick={() => pick(o.value)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-tint/[0.06] disabled:cursor-not-allowed disabled:opacity-50 ${
                o.value === selected?.value ? 'bg-tint/[0.06] text-fg' : 'text-muted'
              }`}
            >
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</label>}
      {children}
      {error ? <p className="mt-1 text-xs text-rose-500">{error}</p> : hint ? <p className="mt-1 text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}

export default Input;
