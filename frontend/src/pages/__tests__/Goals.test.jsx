import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import Goals, { monthsUntil, endOfThisYearIso } from '../Goals.jsx';
import { goalsApi, accountsApi, transactionsApi } from '../../lib/api.js';
import { writePrefs, DEFAULT_PREFS } from '../../lib/preferences.js';

// `globals: false` (see vite.config.js) means @testing-library/react's
// auto-cleanup-after-each never registers (it only self-installs when it
// detects a global `afterEach`), so every RTL render in this file must be
// unmounted explicitly or later tests see leftover DOM from earlier ones.
afterEach(() => cleanup());

vi.mock('../../lib/api.js', async () => {
  const actual = await vi.importActual('../../lib/api.js');
  return {
    ...actual,
    goalsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), contribute: vi.fn() },
    accountsApi: { list: vi.fn() },
    transactionsApi: { list: vi.fn() },
  };
});

vi.mock('../../context/AccountsGateContext.jsx', () => ({
  useAccountsGate: () => ({ loaded: true, hasAccounts: true, accountCount: 2, refresh: vi.fn() }),
}));

describe('monthsUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 15)); // "now" = July 15, 2026
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 1 when no date string is given', () => {
    expect(monthsUntil('')).toBe(1);
    expect(monthsUntil(null)).toBe(1);
    expect(monthsUntil(undefined)).toBe(1);
  });

  it('returns the whole-calendar-month difference for a date 6 months out', () => {
    // now = July 2026, target = January 2027 -> 6 calendar months
    expect(monthsUntil('2027-01-20')).toBe(6);
  });

  it('floors at 1 for a deadline in the past (never returns 0 or negative)', () => {
    expect(monthsUntil('2020-01-01')).toBe(1);
  });

  it('floors at 1 for a deadline within the current calendar month (today)', () => {
    expect(monthsUntil('2026-07-20')).toBe(1);
  });

  it('computes calendar-month difference using year*12 + month, not elapsed days', () => {
    // now = July 2026 (month index 6), target = Sept 2026 (month index 8) -> 2
    expect(monthsUntil('2026-09-01')).toBe(2);
    // now = July 2026, target = July 2027 -> 12 months, regardless of day-of-month
    expect(monthsUntil('2027-07-01')).toBe(12);
  });
});

describe('endOfThisYearIso', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 15));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns Dec 31 of the current year in ISO date form', () => {
    expect(endOfThisYearIso()).toBe('2026-12-31');
  });
});

// GoalModal/ContributeModal are not exported (they're internal to Goals.jsx),
// so they're driven through the real Goals page render, mocking the API
// and account/tx-created contexts the page depends on.
describe('GoalModal and ContributeModal (via rendering the Goals page)', () => {
  const GOAL_FIXTURE = { id: 'g1', name: 'Trip fund', target: 1000, saved: 400, priority: 'medium', color: '#6366f1', icon: 'Target', monthlyContribution: 0, deadline: null };
  const ACCOUNTS_FIXTURE = [{ id: 'a1', name: 'Checking', color: '#000', icon: 'Landmark' }, { id: 'a2', name: 'Savings', color: '#000', icon: 'PiggyBank' }];

  beforeEach(() => {
    vi.clearAllMocks();
    // Fix currency to USD so formatCurrency() output is deterministic
    // regardless of the test runner's locale/timezone.
    writePrefs({ ...DEFAULT_PREFS, currency: 'USD', dateFormat: 'MM/DD/YYYY' });
    goalsApi.list.mockResolvedValue([GOAL_FIXTURE]);
    accountsApi.list.mockResolvedValue(ACCOUNTS_FIXTURE);
    transactionsApi.list.mockResolvedValue([]);
  });

  async function renderGoals() {
    render(
      <MemoryRouter>
        <Goals />
      </MemoryRouter>
    );
    // "Trip fund" itself appears twice once loaded (once in the "Highest
    // priority" card, once in the goal's own grid card), so wait on the
    // unambiguous "New goal" button instead.
    await screen.findByRole('button', { name: /New goal/i });
  }

  describe('GoalModal validation', () => {
    it('requires a goal name', async () => {
      const user = userEvent.setup();
      await renderGoals();
      await user.click(screen.getByRole('button', { name: /New goal/i }));
      await user.click(screen.getByRole('button', { name: /Create goal/i }));
      expect(await screen.findByText('Please enter a goal name.')).toBeInTheDocument();
    });

    it('requires a target amount greater than 0', async () => {
      const user = userEvent.setup();
      await renderGoals();
      await user.click(screen.getByRole('button', { name: /New goal/i }));
      await user.type(screen.getByPlaceholderText(/Emergency fund/i), 'New laptop');
      await user.click(screen.getByRole('button', { name: /Create goal/i }));
      expect(await screen.findByText('Please enter a target amount greater than 0.')).toBeInTheDocument();
    });

    it('rejects a saved amount greater than the target', async () => {
      const user = userEvent.setup();
      await renderGoals();
      await user.click(screen.getByRole('button', { name: /New goal/i }));
      await user.type(screen.getByPlaceholderText(/Emergency fund/i), 'New laptop');
      const numberInputs = screen.getAllByPlaceholderText('0.00');
      await user.type(numberInputs[0], '500'); // target
      await user.type(numberInputs[1], '600'); // saved > target
      await user.click(screen.getByRole('button', { name: /Create goal/i }));
      expect(await screen.findByText('Saved amount cannot exceed the target.')).toBeInTheDocument();
    });
  });

  describe('ContributeModal derived math', () => {
    // Goal fixture: target 1000, saved 400 -> remaining 600.
    async function openContribute() {
      const user = userEvent.setup();
      await renderGoals();
      await user.click(screen.getByRole('button', { name: /Contribute/i }));
      const amountInput = await screen.findByPlaceholderText('0.00');
      return { user, amountInput };
    }

    it('a contribution that does not reach the target: shows projected balance/pct, no target-reached chip, no overshoot warning', async () => {
      const { user, amountInput } = await openContribute();
      await user.type(amountInput, '300');

      // projectedSaved = 400 + 300 = 700; projectedPct = 70%
      expect(await screen.findByText('70% complete')).toBeInTheDocument();
      expect(screen.getByText('$700.00', { exact: false })).toBeInTheDocument();
      expect(screen.queryByText(/Target reached/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/extra will be ignored/i)).not.toBeInTheDocument();
    });

    it('a contribution that exactly reaches the target: shows 100% and the target-reached chip, cappedAmount equals the contribution', async () => {
      const { user, amountInput } = await openContribute();
      await user.type(amountInput, '600'); // exactly the remaining amount

      expect(await screen.findByText('100% complete')).toBeInTheDocument();
      expect(screen.getByText(/Target reached/i)).toBeInTheDocument();
      expect(screen.queryByText(/extra will be ignored/i)).not.toBeInTheDocument();
      // Button label reflects the capped amount actually applied.
      expect(screen.getByRole('button', { name: /Add \$600\.00/i })).toBeInTheDocument();
    });

    it('a contribution that overshoots the target: caps projectedSaved at the target and shows the overshoot warning', async () => {
      const { user, amountInput } = await openContribute();
      await user.type(amountInput, '800'); // 200 more than the 600 remaining

      expect(await screen.findByText('100% complete')).toBeInTheDocument();
      expect(screen.getByText(/Target reached/i)).toBeInTheDocument();
      // overshoot text names the actually-needed remaining amount (600), not the entered 800.
      expect(screen.getByText(/Only \$600\.00 needed — extra will be ignored\./i)).toBeInTheDocument();
      // cappedAmount (600) drives the submit button label, not the raw entered amount (800).
      expect(screen.getByRole('button', { name: /Add \$600\.00/i })).toBeInTheDocument();
    });
  });
});
