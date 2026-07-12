import { Check, X } from 'lucide-react';

const TONES = {
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  danger: 'bg-rose-500',
};
const ICON_TONES = {
  brand: 'text-brand-500',
  success: 'text-emerald-500',
  danger: 'text-rose-500',
};

export function Toggle({ checked, onChange, disabled = false, label, tone = 'brand' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange && onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? TONES[tone] || TONES.brand : 'bg-tint/15'}`}
    >
      {label && <span className="sr-only">{label}</span>}
      <span
        className={`absolute top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      >
        {checked ? (
          <Check size={12} strokeWidth={3} className={ICON_TONES[tone] || ICON_TONES.brand} />
        ) : (
          <X size={12} strokeWidth={3} className="text-subtle" />
        )}
      </span>
    </button>
  );
}

export function ToggleRow({ title, body, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        {body && <p className="mt-0.5 text-xs text-muted">{body}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

export default Toggle;
