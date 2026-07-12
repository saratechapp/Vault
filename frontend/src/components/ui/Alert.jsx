import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const TONES = {
  info: { icon: Info, cls: 'border-info/25 bg-info/10 text-info' },
  success: { icon: CheckCircle2, cls: 'border-success/25 bg-success/10 text-success' },
  warning: { icon: AlertTriangle, cls: 'border-warning/25 bg-warning/10 text-warning' },
  danger: { icon: XCircle, cls: 'border-danger/25 bg-danger/10 text-danger' },
};

// Inline banner alert — distinct from a transient toast; stays until dismissed
// or the condition it describes goes away.
export function Alert({ tone = 'info', title, children, className = '' }) {
  const { icon: Icon, cls } = TONES[tone] || TONES.info;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${cls} ${className}`}>
      <Icon size={17} className="mt-0.5 shrink-0" />
      <div className="text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-muted' : ''}>{children}</div>}
      </div>
    </div>
  );
}

export default Alert;
