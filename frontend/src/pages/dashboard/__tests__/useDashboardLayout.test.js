import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useDashboardLayout, PRESET_DEFAULTS } from '../useDashboardLayout.js';
import { dashboardLayoutApi } from '../../../lib/api.js';
import { scopedKey, setCurrentUserId } from '../../../lib/userScope.js';

// Path is relative to *this test file's* location
// (src/pages/dashboard/__tests__/), not the hook's — the hook itself imports
// '../../lib/api.js' from one directory up.
vi.mock('../../../lib/api.js', () => ({
  dashboardLayoutApi: {
    get: vi.fn(),
    save: vi.fn(),
  },
}));

const STORAGE_KEY = 'wallet_dashboard_layout_v2';

// Lets the initial-mount `dashboardLayoutApi.get()` promise chain (and any
// state update it triggers) settle before assertions run.
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useDashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentUserId(null);
    dashboardLayoutApi.get.mockReset();
    dashboardLayoutApi.save.mockReset();
    dashboardLayoutApi.save.mockResolvedValue(undefined);
    // Default: server has nothing saved yet — local cache/defaults should stand.
    dashboardLayoutApi.get.mockResolvedValue(null);
  });

  afterEach(() => {
    // globals: false means testing-library's own auto-cleanup never
    // registers itself — do it explicitly between tests.
    cleanup();
  });

  it('cycleSpan cycles a widget span 1 -> 2 -> 3 -> 4 -> 1 (including wraparound)', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    const getSpan = () => result.current.layout.find((w) => w.id === 'w-health').span;
    expect(getSpan()).toBe(1);

    act(() => result.current.cycleSpan('w-health'));
    expect(getSpan()).toBe(2);

    act(() => result.current.cycleSpan('w-health'));
    expect(getSpan()).toBe(3);

    act(() => result.current.cycleSpan('w-health'));
    expect(getSpan()).toBe(4);

    act(() => result.current.cycleSpan('w-health'));
    expect(getSpan()).toBe(1);
  });

  it('add appends a new widget to the active preset layout', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    const before = result.current.layout.length;
    act(() => result.current.add('goals', 2));

    expect(result.current.layout.length).toBe(before + 1);
    const added = result.current.layout[result.current.layout.length - 1];
    expect(added.type).toBe('goals');
    expect(added.span).toBe(2);
    expect(added.id).toMatch(/^w-goals-/);
  });

  it('remove deletes a widget by id', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    expect(result.current.layout.some((w) => w.id === 'w-bills')).toBe(true);
    act(() => result.current.remove('w-bills'));
    expect(result.current.layout.some((w) => w.id === 'w-bills')).toBe(false);
  });

  it('move reorders widgets by moving fromId next to toId', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    // Detailed preset starts as: health, expenses, top-vendors, bills, goals, savings-rate, transactions, insight.
    expect(result.current.layout.map((w) => w.id)).toEqual([
      'w-health',
      'w-expenses',
      'w-top-vendors',
      'w-bills',
      'w-goals',
      'w-savings-rate',
      'w-transactions',
      'w-insight',
    ]);

    act(() => result.current.move('w-health', 'w-top-vendors'));

    // Removing 'w-health' first shifts everything left by one, so it lands
    // immediately after 'w-top-vendors' at that (post-removal) index.
    expect(result.current.layout.map((w) => w.id)).toEqual([
      'w-expenses',
      'w-top-vendors',
      'w-health',
      'w-bills',
      'w-goals',
      'w-savings-rate',
      'w-transactions',
      'w-insight',
    ]);
  });

  it('move is a no-op when fromId === toId', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    const idsBefore = result.current.layout.map((w) => w.id);
    act(() => result.current.move('w-health', 'w-health'));
    expect(result.current.layout.map((w) => w.id)).toEqual(idsBefore);
  });

  it('switchPreset("Simple") and switchPreset("Detailed") load the correct preset layouts', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    expect(result.current.activePreset).toBe('Detailed');
    expect(result.current.layout.map((w) => w.id)).toEqual(PRESET_DEFAULTS.Detailed.map((w) => w.id));

    act(() => result.current.switchPreset('Simple'));
    expect(result.current.activePreset).toBe('Simple');
    expect(result.current.layout.map((w) => w.id)).toEqual(PRESET_DEFAULTS.Simple.map((w) => w.id));

    act(() => result.current.switchPreset('Detailed'));
    expect(result.current.activePreset).toBe('Detailed');
    expect(result.current.layout.map((w) => w.id)).toEqual(PRESET_DEFAULTS.Detailed.map((w) => w.id));
  });

  it('switchPreset to an unknown preset name is a no-op', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.switchPreset('DoesNotExist'));
    expect(result.current.activePreset).toBe('Detailed');
  });

  it('reset() restores the active preset to its factory default', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.add('goals', 2));
    act(() => result.current.remove('w-bills'));
    expect(result.current.layout.map((w) => w.id)).not.toEqual(PRESET_DEFAULTS.Detailed.map((w) => w.id));

    act(() => result.current.reset());
    expect(result.current.layout).toEqual(PRESET_DEFAULTS.Detailed);
  });

  it('setSpan sets a widget span directly', async () => {
    const { result } = renderHook(() => useDashboardLayout());
    await flush();

    act(() => result.current.setSpan('w-health', 3));
    expect(result.current.layout.find((w) => w.id === 'w-health').span).toBe(3);
  });

  describe('mount-time reconciliation between local cache and the backend', () => {
    it('lets the remote layout win over the local cache when the backend returns a valid, differing layout', async () => {
      const cached = {
        active: 'Simple',
        presets: {
          Detailed: [...PRESET_DEFAULTS.Detailed],
          Simple: [{ id: 'w-cached-marker', type: 'bills', span: 1 }],
        },
      };
      localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(cached));

      const remote = {
        active: 'Detailed',
        presets: {
          Detailed: [{ id: 'w-remote-marker', type: 'health', span: 2 }],
          Simple: [...PRESET_DEFAULTS.Simple],
        },
      };
      dashboardLayoutApi.get.mockResolvedValue(remote);

      const { result } = renderHook(() => useDashboardLayout());

      // Before the get() promise resolves, the local cache is what's showing.
      expect(result.current.activePreset).toBe('Simple');
      expect(result.current.layout.map((w) => w.id)).toEqual(['w-cached-marker']);

      await flush();

      // Once the backend responds with a valid layout, it wins.
      expect(result.current.activePreset).toBe('Detailed');
      expect(result.current.layout.map((w) => w.id)).toEqual(['w-remote-marker']);
    });

    it('keeps the local cache when the backend returns nothing (never customized before)', async () => {
      const cached = {
        active: 'Simple',
        presets: {
          Detailed: [...PRESET_DEFAULTS.Detailed],
          Simple: [{ id: 'w-cached-marker', type: 'bills', span: 1 }],
        },
      };
      localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(cached));
      dashboardLayoutApi.get.mockResolvedValue(null);

      const { result } = renderHook(() => useDashboardLayout());
      await flush();

      expect(result.current.activePreset).toBe('Simple');
      expect(result.current.layout.map((w) => w.id)).toEqual(['w-cached-marker']);
    });

    it('keeps the local cache when the backend request fails', async () => {
      const cached = {
        active: 'Detailed',
        presets: {
          Detailed: [{ id: 'w-cached-marker', type: 'bills', span: 1 }],
          Simple: [...PRESET_DEFAULTS.Simple],
        },
      };
      localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(cached));
      dashboardLayoutApi.get.mockRejectedValue(new Error('network error'));

      const { result } = renderHook(() => useDashboardLayout());
      await flush();

      expect(result.current.layout.map((w) => w.id)).toEqual(['w-cached-marker']);
    });

    it('falls back to factory defaults when there is neither a local cache nor a usable remote value', async () => {
      dashboardLayoutApi.get.mockResolvedValue(null);
      const { result } = renderHook(() => useDashboardLayout());
      await flush();

      expect(result.current.activePreset).toBe('Detailed');
      expect(result.current.layout).toEqual(PRESET_DEFAULTS.Detailed);
    });

    it('does not push a save back to the backend before the initial get() has resolved', async () => {
      let resolveGet;
      dashboardLayoutApi.get.mockReturnValue(
        new Promise((resolve) => {
          resolveGet = resolve;
        })
      );

      renderHook(() => useDashboardLayout());
      // The state-effect has already run once synchronously (it writes to
      // localStorage on every state change), but get() hasn't resolved yet.
      expect(dashboardLayoutApi.save).not.toHaveBeenCalled();

      await act(async () => {
        resolveGet(null);
        await Promise.resolve();
      });
    });
  });
});
