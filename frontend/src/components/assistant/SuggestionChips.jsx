import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, Plus, Wallet, Target } from 'lucide-react';
import { SUGGESTED_QUESTIONS } from '../../lib/assistant/intents.js';
import { Button } from '../ui/index.js';
import { useNewTransaction } from '../../context/NewTransactionContext.jsx';
import { useAssistant } from '../../context/AssistantContext.jsx';

export function SuggestionChips({ onPick }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SUGGESTED_QUESTIONS.map((q) => (
        <motion.button
          key={q.label}
          type="button"
          onClick={() => onPick(q.label)}
          whileHover={{ y: -2, scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="chip transition-colors hover:border-line-strong hover:bg-tint/[0.08]"
        >
          <span>{q.emoji}</span> {q.label}
        </motion.button>
      ))}
    </div>
  );
}

export function EmptyStateQuickActions() {
  const navigate = useNavigate();
  const { open: openNewTransaction } = useNewTransaction();
  const { close } = useAssistant();
  // Navigating away without closing left the floating panel/bottom-sheet
  // sitting on top of the destination page (see QuickActionCard.jsx) —
  // "Add Transaction" is the one exception since it opens a modal in place
  // rather than leaving the current page, so the assistant staying open
  // behind it is fine there.
  const actions = [
    { label: 'Add Account', icon: CreditCard, onClick: () => { close(); navigate('/app/accounts'); } },
    { label: 'Add Transaction', icon: Plus, onClick: openNewTransaction },
    { label: 'Create Budget', icon: Wallet, onClick: () => { close(); navigate('/app/budgets'); } },
    { label: 'Create Savings Goal', icon: Target, onClick: () => { close(); navigate('/app/goals'); } },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button key={a.label} variant="outline" size="sm" leftIcon={<a.icon size={14} />} onClick={a.onClick}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

export default SuggestionChips;
