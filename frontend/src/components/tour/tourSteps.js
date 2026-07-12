// Every target lives on the Dashboard page (see data-tour attributes in
// Sidebar.jsx, Topbar.jsx and Dashboard.jsx) so the tour never has to
// navigate the user mid-walkthrough — it just spotlights different regions
// of the one screen they land on right after signing in.
export const TOUR_STEPS = [
  {
    id: 'overview',
    targets: ['[data-tour="dashboard-overview"]'],
    title: 'Welcome to Personal Budget.',
    body: 'This dashboard gives you a complete view of your financial health, cash flow, budgets, AI insights, and reports.',
  },
  {
    id: 'accounts',
    targets: ['[data-tour="sidebar-accounts"]', '[data-tour="add-account-cta"]'],
    title: 'Create your first account',
    body: 'Before you can record any financial activity, you must create your first account — a bank account, cash, wallet, or credit card. This is a required step.',
    mandatory: true,
  },
  {
    id: 'add-transaction',
    targets: ['[data-tour="new-transaction-btn"]'],
    title: 'Record income & expenses',
    body: 'Once your first account has been created, you can begin recording your income and expenses. Every report, budget, AI insight, and analytics depends on your transaction history.',
  },
  {
    id: 'insights',
    targets: ['[data-tour="ai-insights"]'],
    title: 'Track and improve',
    body: 'Monitor your financial health, track your budgets, achieve your savings goals, and receive AI-powered financial recommendations. Click Finish to start using the application.',
  },
];
