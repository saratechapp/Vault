import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchRates } from '../fx.js';

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

describe('fetchRates', () => {
  let fetchMock;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('fetches from the primary host on a cache miss', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9, gbp: 0.8 } }));

    const rates = await fetchRates('USD');

    expect(rates).toEqual({ eur: 0.9, gbp: 0.8 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('cdn.jsdelivr.net');
    expect(fetchMock.mock.calls[0][0]).toContain('/usd.json');
  });

  it('returns the cached value on a second call within the cache window without re-fetching', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9 } }));
    await fetchRates('USD');

    const rates = await fetchRates('USD');
    expect(rates).toEqual({ eur: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bypasses the cache when force is true', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9 } }));
    await fetchRates('USD');

    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.95 } }));
    const rates = await fetchRates('USD', { force: true });

    expect(rates).toEqual({ eur: 0.95 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('re-fetches after the cache entry has expired (older than 1 hour)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T10:00:00Z'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9 } }));
    await fetchRates('USD');

    vi.setSystemTime(new Date('2026-07-12T11:00:01Z')); // just past the 1-hour TTL
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.99 } }));
    const rates = await fetchRates('USD');

    expect(rates).toEqual({ eur: 0.99 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('falls back to the secondary host when the primary host throws', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9 } }));

    const rates = await fetchRates('USD');

    expect(rates).toEqual({ eur: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('latest.currency-api.pages.dev');
  });

  it('falls back to the secondary host when the primary host responds not-ok', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9 } }));

    const rates = await fetchRates('USD');

    expect(rates).toEqual({ eur: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when both primary and fallback hosts fail', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false));

    await expect(fetchRates('USD')).rejects.toThrow('fx fetch failed');
  });

  it('lowercases the base currency for the request URL and cache key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ usd: { eur: 0.9 } }));
    await fetchRates('USD');
    expect(fetchMock.mock.calls[0][0]).toContain('/usd.json');

    // Second call with a different case should still hit the same cache entry.
    const rates = await fetchRates('usd');
    expect(rates).toEqual({ eur: 0.9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty object when the response has no entry for the base currency', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ someOtherKey: {} }));
    const rates = await fetchRates('USD');
    expect(rates).toEqual({});
  });
});
