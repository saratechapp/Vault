import { useEffect, useMemo, useState } from 'react';
import { scopedKey } from '../../lib/userScope.js';

const ORDER_KEY = 'wallet_account_order_v1';
const PINS_KEY = 'wallet_account_pins_v1';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(scopedKey(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Account card order + pins are per-browser (localStorage), not synced to
// the backend like the widget grid — the doc only asks for cross-device sync
// on the widget layout, not the account strip, so this stays lightweight.
// Still namespaced per signed-in user (lib/userScope.js) so it can't bleed
// across accounts sharing a browser.
export function useAccountOrder(accountIds) {
  const [order, setOrder] = useState(() => readJSON(ORDER_KEY, []));
  const [pinned, setPinned] = useState(() => new Set(readJSON(PINS_KEY, [])));

  useEffect(() => {
    localStorage.setItem(scopedKey(ORDER_KEY), JSON.stringify(order));
  }, [order]);
  useEffect(() => {
    localStorage.setItem(scopedKey(PINS_KEY), JSON.stringify([...pinned]));
  }, [pinned]);

  const orderedIds = useMemo(() => {
    const known = order.filter((id) => accountIds.includes(id));
    const unknown = accountIds.filter((id) => !known.includes(id));
    const merged = [...known, ...unknown];
    const pinnedIds = merged.filter((id) => pinned.has(id));
    const restIds = merged.filter((id) => !pinned.has(id));
    return [...pinnedIds, ...restIds];
  }, [order, pinned, accountIds]);

  const moveId = (fromId, toId) => {
    if (fromId === toId) return;
    setOrder(() => {
      const base = [...orderedIds];
      const fromIdx = base.indexOf(fromId);
      const toIdx = base.indexOf(toId);
      if (fromIdx === -1 || toIdx === -1) return order;
      const next = [...base];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const togglePin = (id) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return { orderedIds, pinned, moveId, togglePin };
}

export default useAccountOrder;
