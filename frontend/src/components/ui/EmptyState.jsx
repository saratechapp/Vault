
export function EmptyState({ icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      {icon && <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-tint/[0.05] text-subtle">{icon}</div>}
      {title && <h3 className="font-display text-base font-semibold text-fg">{title}</h3>}
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
