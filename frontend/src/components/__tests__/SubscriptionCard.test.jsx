import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SubscriptionCard } from '../SubscriptionCard.jsx';

// `globals: false` (see vite.config.js) — no auto cleanup, unmount manually.
afterEach(() => cleanup());

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderCard(subscription) {
  return render(
    <MemoryRouter>
      <SubscriptionCard subscription={subscription} />
    </MemoryRouter>
  );
}

// A trial ending N days from now, as the API would send it (ISO string).
// Just under N full days so Math.ceil(remaining) === N.
function trialEndingInDays(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000 - 60_000).toISOString();
}

describe('SubscriptionCard', () => {
  it('FREE_ACCESS: shows the free-access pill, no countdown', () => {
    renderCard({ status: 'FREE_ACCESS', type: 'FREE_ACCESS' });
    expect(screen.getByText(/free access/i)).toBeInTheDocument();
    expect(screen.queryByText(/days left/i)).not.toBeInTheDocument();
  });

  it('FREE_TRIAL: derives the day count live from trialEndDate, not from a passed-in number', () => {
    renderCard({
      status: 'FREE_TRIAL',
      type: 'FREE_TRIAL',
      trialStartDate: '2026-01-01T00:00:00.000Z',
      trialEndDate: trialEndingInDays(23),
      daysRemaining: 999, // must be ignored — the card recomputes from the date
    });
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText(/days left/i)).toBeInTheDocument();
    expect(screen.getByText(/subscribe now to keep your access/i)).toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });

  it('EXPIRED: shows the ended message and a Subscribe now action', () => {
    renderCard({ status: 'EXPIRED', type: 'FREE_TRIAL', trialEndDate: trialEndingInDays(-3) });
    expect(screen.getByText(/your free trial has ended/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subscribe now/i })).toBeInTheDocument();
  });

  it('ACTIVE: shows the active pill and renewal date', () => {
    renderCard({ status: 'ACTIVE', type: 'ACTIVE', subscriptionEndDate: '2027-01-20T00:00:00.000Z' });
    expect(screen.getByText(/^active$/i)).toBeInTheDocument();
    expect(screen.getByText(/renews/i)).toBeInTheDocument();
  });

  it('falls back to FREE_ACCESS when given no subscription', () => {
    renderCard(null);
    expect(screen.getByText(/free access/i)).toBeInTheDocument();
  });
});
