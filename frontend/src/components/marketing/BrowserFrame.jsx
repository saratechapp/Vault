// Browser chrome wrapper for the web-app showcase. Pure CSS, theme-aware.
export function BrowserFrame({ children, url = 'app.vaultfinance.com/dashboard', className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-xl dark:bg-surface ${className}`}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
        <div className="ml-3 hidden min-w-0 flex-1 items-center rounded-md bg-tint/[0.05] px-3 py-1 text-xs text-subtle sm:flex">
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

export default BrowserFrame;
