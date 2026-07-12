import { Link } from 'react-router-dom';
import { Landmark, Plus } from 'lucide-react';
import { EmptyState, Button } from './ui/index.js';

// Replaces a whole page's content (Budgets/Bills/Goals/Debts) when the user
// has zero accounts — every one of those features derives from account
// balances/transactions, so there's nothing meaningful to show yet.
export function MandatoryAccountGate() {
  return (
    <EmptyState
      icon={<Landmark size={22} />}
      title="Create your first account"
      body="You need to create your first account before you can start managing your finances."
      action={<Button as={Link} to="/app/accounts" leftIcon={<Plus size={15} />}>Create Account</Button>}
    />
  );
}

export default MandatoryAccountGate;
