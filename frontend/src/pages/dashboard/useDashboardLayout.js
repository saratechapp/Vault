import { useCallback, useEffect, useRef, useState } from 'react';
import { dashboardLayoutApi } from '../../lib/api.js';
import { scopedKey } from '../../lib/userScope.js';

const STORAGE_KEY = 'wallet_dashboard_layout_v2';

// Widgets are grouped into full rows on purpose: a span-1 card only looks
// "the same size" as another span-1 card when they actually share a row.
// Left in mismatched rows (e.g. paired with a span-2 chart on one side and
// two other span-1 cards on the other), same-width cards still read as
// inconsistent because they're never compared side by side.
//
// Two starter presets: a curated "Simple" view (top-priority widgets only)
// and the fuller "Detailed" view (everything). Either preset's contents can
// be freely customized (add/remove/resize/reorder) per user — these are
// just what "Reset to default" restores for that preset.
export const PRESET_DEFAULTS = {
  Detailed: [
    { id: 'w-health', type: 'health', span: 1 },
    { id: 'w-expenses', type: 'expenses-structure', span: 1 },
    { id: 'w-top-vendors', type: 'top-vendors', span: 1 },
    { id: 'w-bills', type: 'bills', span: 1 },
    { id: 'w-goals', type: 'goals', span: 1 },
    { id: 'w-savings-rate', type: 'savings-rate', span: 1 },
    { id: 'w-transactions', type: 'transactions', span: 3 },
    { id: 'w-insight', type: 'insight', span: 3 },
  ],
  Simple: [
    { id: 'w-bills', type: 'bills', span: 1 },
    { id: 'w-expenses', type: 'expenses-structure', span: 1 },
    { id: 'w-budget-adherence', type: 'ai-budget-adherence', span: 1 },
  ],
};
const DEFAULT_STATE = { active: 'Detailed', presets: { Detailed: [...PRESET_DEFAULTS.Detailed], Simple: [...PRESET_DEFAULTS.Simple] } };

function readCache() {
  try {
    const raw = localStorage.getItem(scopedKey(STORAGE_KEY));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && parsed.presets && parsed.active ? parsed : null;
  } catch {
    return null;
  }
}

export function useDashboardLayout() {
  const [state, setState] = useState(() => readCache() || DEFAULT_STATE);
  const loadedRef = useRef(false);

  // Reconcile with the backend once on mount — the server is the
  // cross-device source of truth, so it wins over the local cache when
  // present. An empty server value just means "never customized before,"
  // in which case the local cache (or factory defaults) seeds it on the
  // next save below.
  useEffect(() => {
    let cancelled = false;
    dashboardLayoutApi
      .get()
      .then((remote) => {
        if (cancelled) return;
        if (remote && remote.presets && remote.active) setState(remote);
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(scopedKey(STORAGE_KEY), JSON.stringify(state));
    if (!loadedRef.current) return; // don't push the local cache over a not-yet-fetched remote value
    dashboardLayoutApi.save(state).catch(() => {});
  }, [state]);

  const layout = state.presets[state.active] || [];
  const presetNames = Object.keys(state.presets);

  const updateActive = useCallback((updater) => {
    setState((prev) => ({ ...prev, presets: { ...prev.presets, [prev.active]: updater(prev.presets[prev.active] || []) } }));
  }, []);

  const add = useCallback(
    (type, span = 1) => {
      updateActive((list) => [...list, { id: `w-${type}-${Date.now().toString(36)}`, type, span }]);
    },
    [updateActive]
  );

  const remove = useCallback(
    (id) => {
      updateActive((list) => list.filter((w) => w.id !== id));
    },
    [updateActive]
  );

  const move = useCallback(
    (fromId, toId) => {
      if (fromId === toId) return;
      updateActive((list) => {
        const fromIdx = list.findIndex((w) => w.id === fromId);
        const toIdx = list.findIndex((w) => w.id === toId);
        if (fromIdx === -1 || toIdx === -1) return list;
        const next = [...list];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    },
    [updateActive]
  );

  const setSpan = useCallback(
    (id, span) => {
      updateActive((list) => list.map((w) => (w.id === id ? { ...w, span } : w)));
    },
    [updateActive]
  );

  // 4 sizes: small(1) / medium(2) / large(3) / full-width(4).
  const cycleSpan = useCallback(
    (id) => {
      updateActive((list) => list.map((w) => (w.id === id ? { ...w, span: (w.span % 4) + 1 } : w)));
    },
    [updateActive]
  );

  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      presets: { ...prev.presets, [prev.active]: PRESET_DEFAULTS[prev.active] ? [...PRESET_DEFAULTS[prev.active]] : [] },
    }));
  }, []);

  const switchPreset = useCallback((name) => {
    setState((prev) => (prev.presets[name] ? { ...prev, active: name } : prev));
  }, []);

  return { layout, activePreset: state.active, presetNames, add, remove, move, setSpan, cycleSpan, reset, switchPreset };
}

export default useDashboardLayout;
