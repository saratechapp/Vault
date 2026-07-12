import { Link } from 'react-router-dom';
import { Tooltip } from './ui/index.js';

// Wraps a "blocked by the mandatory-account rule" trigger (Add Transaction,
// Import) with a hoverable/focusable tooltip explaining why and linking
// straight to Accounts to fix it. Pass-through (no tooltip) when not blocked.
export function NoAccountsTooltip({ blocked, side = 'bottom', children }) {
  if (!blocked) return children;
  return (
    <Tooltip
      side={side}
      interactive
      label={
        <span className="flex flex-col items-start gap-1.5">
          <span>Add at least 1 account to enable this.</span>
          <Link to="/app/accounts" className="font-semibold text-brand-300 underline underline-offset-2 hover:text-brand-200">
            Create an account →
          </Link>
        </span>
      }
    >
      {children}
    </Tooltip>
  );
}

export default NoAccountsTooltip;
