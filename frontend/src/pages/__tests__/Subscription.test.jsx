import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Subscription from '../Subscription.jsx';
import { subscriptionApi } from '../../lib/api.js';

// `globals: false` — manual cleanup.
afterEach(() => cleanup());

vi.mock('../../lib/api.js', () => ({
  subscriptionApi: { get: vi.fn(), setCurrency: vi.fn() },
}));
vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { subscription: null } }),
}));

function pricing(code = 'INR', symbol = '₹', monthly = 50, yearly = 500) {
  return {
    currency: code,
    source: 'account',
    defaultCurrency: 'INR',
    configured: true,
    currencies: [
      { code: 'INR', symbol: '₹', name: 'Indian Rupee', monthly: 50, yearly: 500,
        monthlyFormatted: '₹50', yearlyFormatted: '₹500', yearlySavingsPct: 17,
        yearlyEquivalentMonthly: 41.67, yearlyEquivalentMonthlyFormatted: '₹41.67' },
      { code: 'USD', symbol: '$', name: 'US Dollar', monthly: 2, yearly: 20,
        monthlyFormatted: '$2', yearlyFormatted: '$20', yearlySavingsPct: 17,
        yearlyEquivalentMonthly: 1.67, yearlyEquivalentMonthlyFormatted: '$1.67' },
    ],
    selected: {
      code, symbol, monthly, yearly,
      monthlyFormatted: `${symbol}${monthly}`, yearlyFormatted: `${symbol}${yearly}`,
      yearlySavingsPct: 17, yearlyEquivalentMonthly: yearly / 12,
      yearlyEquivalentMonthlyFormatted: `${symbol}${(yearly / 12).toFixed(2)}`,
    },
  };
}

describe('Subscription page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders both plan cards with prices from the API (not hardcoded) when enforcement is on', async () => {
    subscriptionApi.get.mockResolvedValue({ status: 'FREE_ACCESS', enforcementEnabled: true, pricing: pricing() });
    render(<Subscription />);

    expect(await screen.findByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Yearly')).toBeInTheDocument();
    expect(screen.getByText('₹50')).toBeInTheDocument();
    expect(screen.getByText('₹500')).toBeInTheDocument();
    expect(screen.getByText(/save 17% vs monthly/i)).toBeInTheDocument();
  });

  it('disables the Monthly & Yearly section when subscription enforcement is OFF', async () => {
    subscriptionApi.get.mockResolvedValue({ status: 'FREE_ACCESS', enforcementEnabled: false, pricing: pricing() });
    render(<Subscription />);

    expect(await screen.findByText(/monthly & yearly plans/i)).toBeInTheDocument();
    expect(screen.getByText(/not active/i)).toBeInTheDocument();
    expect(screen.getByText(/plans activate only if the team turns subscription enforcement on/i)).toBeInTheDocument();
    // the interactive plan cards + subscribe buttons are not rendered
    expect(screen.queryByText('Yearly')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /subscribe/i })).not.toBeInTheDocument();
    // prices still shown as a read-only preview
    expect(screen.getByText(/preview · ₹50\/mo · ₹500\/yr/i)).toBeInTheDocument();
  });

  it('shows a "not configured" notice when paid pricing is unpublished (Free card still renders)', async () => {
    subscriptionApi.get.mockResolvedValue({
      status: 'FREE_ACCESS',
      trial: { enabled: false, durationMonths: 1 },
      pricing: { configured: false, currencies: [], selected: null, source: 'default', defaultCurrency: 'INR' },
    });
    render(<Subscription />);
    expect(await screen.findByText(/paid plans are being finalised/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^free$/i })).toBeInTheDocument();
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
  });

  it('Free card: shows the current-plan state on free access, and a live "N days left" countdown during a trial', async () => {
    subscriptionApi.get.mockResolvedValueOnce({
      status: 'FREE_ACCESS',
      trial: { enabled: true, durationMonths: 2 },
      pricing: pricing(),
    });
    const { unmount } = render(<Subscription />);
    expect(await screen.findByText(/your current plan/i)).toBeInTheDocument();
    expect(screen.getByText(/new accounts get a 2-month free trial/i)).toBeInTheDocument();
    unmount();

    subscriptionApi.get.mockResolvedValueOnce({
      status: 'FREE_TRIAL',
      trial: { enabled: true, durationMonths: 1 },
      trialStartDate: new Date(Date.now() - 18 * 86400000).toISOString(),
      trialEndDate: new Date(Date.now() + 12 * 86400000 - 60_000).toISOString(),
      pricing: pricing(),
    });
    render(<Subscription />);
    expect(await screen.findByRole('heading', { name: /free trial/i })).toBeInTheDocument();
    // highlighted trial notification: countdown + exact backend valid-until date
    expect(screen.getByText(/free trial active/i)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/days left/i)).toBeInTheDocument();
    expect(screen.getByText(/free until/i)).toBeInTheDocument();
    expect(screen.getByText(/trial started/i)).toBeInTheDocument();
  });

  it('changing the currency selector calls setCurrency and swaps the displayed prices', async () => {
    const user = userEvent.setup();
    subscriptionApi.get.mockResolvedValue({ status: 'FREE_ACCESS', enforcementEnabled: true, pricing: pricing('INR', '₹', 50, 500) });
    subscriptionApi.setCurrency.mockResolvedValue({ pricing: pricing('USD', '$', 2, 20) });
    render(<Subscription />);

    await screen.findByText('₹50');
    await user.click(screen.getByRole('button', { name: /INR/ })); // Select trigger
    await user.click(await screen.findByText(/USD \$/));

    await waitFor(() => expect(subscriptionApi.setCurrency).toHaveBeenCalledWith('USD'));
    expect(await screen.findByText('$2')).toBeInTheDocument();
    expect(screen.getByText('$20')).toBeInTheDocument();
  });

  it('EXPIRED shows the "trial has ended" banner and a "Trial ended" state on the Free card', async () => {
    subscriptionApi.get.mockResolvedValue({
      status: 'EXPIRED',
      enforcementEnabled: true,
      trial: { enabled: true, durationMonths: 1 },
      trialEndDate: new Date(Date.now() - 3 * 86400000).toISOString(),
      pricing: pricing(),
    });
    render(<Subscription />);
    expect(await screen.findByText(/your free trial has ended/i)).toBeInTheDocument();
    expect(screen.getByText('Trial ended')).toBeInTheDocument();
  });
});
