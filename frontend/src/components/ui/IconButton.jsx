
// Small icon-only row action button — the Edit/Delete pair repeated across
// every list page (Settings, Goals, Bills, Budgets, Accounts, Debts, Transactions).
// <IconButton icon={Pencil} onClick={...} label="Edit" />
// <IconButton icon={Trash2} variant="danger" onClick={...} label="Delete" />
const VARIANTS = {
  default: 'text-muted hover:bg-tint/[0.06] hover:text-fg',
  danger: 'text-muted hover:bg-rose-500/10 hover:text-rose-500',
};

export function IconButton({ icon: Icon, size = 14, variant = 'default', label, title, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={`rounded-lg p-1.5 ${VARIANTS[variant] || VARIANTS.default} ${className}`}
      {...rest}
    >
      <Icon size={size} />
    </button>
  );
}

export default IconButton;
