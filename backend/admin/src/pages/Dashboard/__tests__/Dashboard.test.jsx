import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import Dashboard from '../Dashboard.jsx';
import { api } from '../../../lib/api.js';

vi.mock('../../../lib/api.js', () => ({
  api: {
    get: vi.fn(),
  },
}));

// Replace the recharts-backed chart components with lightweight stand-ins so
// we can assert on the exact data passed in, without needing a
// ResizeObserver polyfill or dealing with SVG geometry in jsdom.
vi.mock('../../../components/charts/SimpleBarChart.jsx', () => ({
  SimpleBarChart: ({ data }) => (
    <div data-testid="bar-chart">
      {data.map((d, i) => (
        <div key={i} data-testid="bar-item">{JSON.stringify(d)}</div>
      ))}
    </div>
  ),
}));
vi.mock('../../../components/charts/SimpleLineChart.jsx', () => ({
  SimpleLineChart: ({ data }) => <div data-testid="line-chart">{data.length}</div>,
}));

const overview = {
  totalUsers: 1000,
  activeUsers: 400,
  newUsersToday: 12,
  premiumSubscribers: 150,
  freeUsers: 850,
  suspendedUsers: 5,
  dailyTransactions: 300,
  totalBudgets: 60,
  aiRequestsToday: 42,
  totalFeedback: 20,
  openFeedback: 4,
  criticalFeedback: 1,
};

const userGrowth = [{ date: '2026-06-01', count: 5 }, { date: '2026-06-02', count: 8 }];
const dauMau = { dau: [{ date: '2026-06-01', count: 3 }], mau: 321 };
const devices = [{ device: 'iOS', count: 40 }, { device: 'Android', count: 60 }];
// 15 countries, ordered by count descending — Dashboard just slices the
// first 10 as returned by the server; it does not re-sort client-side.
const countries = Array.from({ length: 15 }, (_, i) => ({ country: `C${i + 1}`, count: 200 - i * 5 }));
const feedbackTrend = [{ date: '2026-06-01', count: 2 }];

function mockApiGet() {
  api.get.mockImplementation((path) => {
    switch (path) {
      case '/dashboard/overview': return Promise.resolve(overview);
      case '/dashboard/user-growth': return Promise.resolve(userGrowth);
      case '/dashboard/dau-mau': return Promise.resolve(dauMau);
      case '/dashboard/device-distribution': return Promise.resolve(devices);
      case '/dashboard/country-distribution': return Promise.resolve(countries);
      case '/dashboard/feedback-trend': return Promise.resolve(feedbackTrend);
      default: return Promise.reject(new Error(`unexpected GET ${path}`));
    }
  });
}

function statCardValue(label) {
  const card = screen.getByText(label).closest('.MuiCard-root');
  return within(card);
}

describe('Dashboard', () => {
  beforeEach(() => {
    mockApiGet();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('fetches all six dashboard endpoints in parallel', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(6));
    const paths = api.get.mock.calls.map((c) => c[0]);
    expect(paths).toEqual(expect.arrayContaining([
      '/dashboard/overview',
      '/dashboard/user-growth',
      '/dashboard/dau-mau',
      '/dashboard/device-distribution',
      '/dashboard/country-distribution',
      '/dashboard/feedback-trend',
    ]));
  });

  it('renders stat cards with values passed through directly from the overview response', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(statCardValue('Total users').getByText('1000')).toBeInTheDocument());

    expect(statCardValue('Active users (30d)').getByText('400')).toBeInTheDocument();
    expect(statCardValue('New users today').getByText('12')).toBeInTheDocument();
    expect(statCardValue('Premium subscribers').getByText('150')).toBeInTheDocument();
    expect(statCardValue('Free users').getByText('850')).toBeInTheDocument();
    expect(statCardValue('Suspended users').getByText('5')).toBeInTheDocument();
    expect(statCardValue('Daily transactions').getByText('300')).toBeInTheDocument();
    expect(statCardValue('Total budgets').getByText('60')).toBeInTheDocument();
    expect(statCardValue('AI requests today').getByText('42')).toBeInTheDocument();
    expect(statCardValue('Total feedback').getByText('20')).toBeInTheDocument();
    expect(statCardValue('Open feedback').getByText('4')).toBeInTheDocument();
    expect(statCardValue('Critical feedback').getByText('1')).toBeInTheDocument();
  });

  it('renders 0 for a stat when the overview response omits it', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/dashboard/overview') return Promise.resolve({});
      if (path === '/dashboard/user-growth') return Promise.resolve([]);
      if (path === '/dashboard/dau-mau') return Promise.resolve({ dau: [], mau: 0 });
      if (path === '/dashboard/device-distribution') return Promise.resolve([]);
      if (path === '/dashboard/country-distribution') return Promise.resolve([]);
      if (path === '/dashboard/feedback-trend') return Promise.resolve([]);
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    render(<Dashboard />);
    await waitFor(() => expect(statCardValue('Total users').getByText('0')).toBeInTheDocument());
  });

  it('slices the country distribution to the top 10 entries client-side, preserving server order', async () => {
    render(<Dashboard />);

    const barCharts = await waitFor(() => {
      const charts = screen.getAllByTestId('bar-chart');
      expect(charts).toHaveLength(2); // devices chart + countries chart
      return charts;
    });

    // Devices chart (rendered first) — should show all devices unmodified.
    const deviceItems = within(barCharts[0]).getAllByTestId('bar-item');
    expect(deviceItems).toHaveLength(2);

    // Countries chart (rendered second, full width) — sliced to 10.
    const countryItems = within(barCharts[1]).getAllByTestId('bar-item');
    expect(countryItems).toHaveLength(10);

    const rendered = countryItems.map((el) => JSON.parse(el.textContent));
    expect(rendered).toEqual(countries.slice(0, 10));
    expect(rendered.map((c) => c.country)).not.toContain('C11');
  });

  it('shows an error alert when a dashboard fetch fails', async () => {
    api.get.mockImplementation((path) => {
      if (path === '/dashboard/overview') return Promise.reject(new Error('Server exploded'));
      return Promise.resolve([]);
    });
    render(<Dashboard />);
    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
  });
});
