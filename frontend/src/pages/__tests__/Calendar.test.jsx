import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CalendarPage from '../Calendar.jsx';
import { transactionsApi, categoriesApi, accountsApi, billsApi } from '../../lib/api.js';

// `globals: false` (see vite.config.js) means @testing-library/react's
// auto-cleanup-after-each never registers, so every render here must be
// unmounted explicitly or later tests see leftover DOM from earlier ones.
afterEach(() => cleanup());

vi.mock('../../lib/api.js', async () => {
  const actual = await vi.importActual('../../lib/api.js');
  return {
    ...actual,
    transactionsApi: { list: vi.fn() },
    categoriesApi: { list: vi.fn() },
    accountsApi: { list: vi.fn() },
    billsApi: { list: vi.fn() },
  };
});

// CalendarPage navigates to the Bills page when a bill-due entry is tapped
// (useNavigate), which throws outside a Router context.
function renderCalendar() {
  return render(<CalendarPage />, { wrapper: MemoryRouter });
}

describe('Calendar page (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fix "today" to July 15 2026 so the month grid is deterministic
    // regardless of what date the test suite actually runs on. Only Date is
    // faked (not setTimeout/setInterval) so RTL's async findBy/waitFor
    // polling keeps working normally.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 15));
    transactionsApi.list.mockResolvedValue([]);
    categoriesApi.list.mockResolvedValue([]);
    accountsApi.list.mockResolvedValue([]);
    billsApi.list.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders 35 day cells for July 2026 (a month starting on a Wednesday)', async () => {
    renderCalendar();
    // July 1 2026 is a Wednesday -> 3 leading + 31 in-month + 1 trailing = 35
    const dayButtons = await screen.findAllByRole('button', { name: /^(\d{1,2})$/ });
    expect(dayButtons).toHaveLength(35);
  });

  it('renders the month header label for the fixed system date', async () => {
    renderCalendar();
    expect(await screen.findByText('July 2026')).toBeInTheDocument();
  });
});
