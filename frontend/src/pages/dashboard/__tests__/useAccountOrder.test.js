import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useAccountOrder } from '../useAccountOrder.js';
import { setCurrentUserId } from '../../../lib/userScope.js';

describe('useAccountOrder', () => {
  beforeEach(() => {
    localStorage.clear();
    setCurrentUserId('test-user-1');
  });

  afterEach(() => {
    // globals: false means testing-library's own auto-cleanup never
    // registers itself — do it explicitly between tests.
    cleanup();
  });

  it('defaults orderedIds to the input accountIds when nothing is pinned/reordered', () => {
    const accountIds = ['a', 'b', 'c'];
    const { result } = renderHook(() => useAccountOrder(accountIds));

    expect(result.current.orderedIds).toEqual(['a', 'b', 'c']);
    expect(result.current.pinned.size).toBe(0);
  });

  it('togglePin moves the account to the front and keeps pinned accounts ahead of unpinned ones', () => {
    const accountIds = ['a', 'b', 'c'];
    const { result } = renderHook(() => useAccountOrder(accountIds));

    act(() => {
      result.current.togglePin('c');
    });
    expect(result.current.orderedIds).toEqual(['c', 'a', 'b']);
    expect(result.current.pinned.has('c')).toBe(true);

    act(() => {
      result.current.togglePin('a');
    });
    // Both pinned now — the pinned bucket is filtered from the *merged*
    // (accountIds) order, not pin-toggle chronological order, so 'a' (which
    // precedes 'c' in accountIds) comes first.
    expect(result.current.orderedIds).toEqual(['a', 'c', 'b']);

    act(() => {
      result.current.togglePin('c');
    });
    // Unpinning 'c' drops it back into the unpinned bucket at its natural position.
    expect(result.current.orderedIds).toEqual(['a', 'b', 'c']);
    expect(result.current.pinned.has('c')).toBe(false);
  });

  it('moveId reorders accounts by moving fromId to toId\'s position', () => {
    const accountIds = ['a', 'b', 'c'];
    const { result } = renderHook(() => useAccountOrder(accountIds));

    act(() => {
      result.current.moveId('a', 'c');
    });

    expect(result.current.orderedIds).toEqual(['b', 'c', 'a']);
  });

  it('moveId is a no-op when fromId and toId are the same', () => {
    const accountIds = ['a', 'b', 'c'];
    const { result } = renderHook(() => useAccountOrder(accountIds));

    act(() => {
      result.current.moveId('b', 'b');
    });

    expect(result.current.orderedIds).toEqual(['a', 'b', 'c']);
  });

  it('moveId is a no-op when either id is unknown', () => {
    const accountIds = ['a', 'b', 'c'];
    const { result } = renderHook(() => useAccountOrder(accountIds));

    act(() => {
      result.current.moveId('a', 'z');
    });

    expect(result.current.orderedIds).toEqual(['a', 'b', 'c']);
  });

  it('keeps a pinned account first even after moveId reorders around it', () => {
    const accountIds = ['a', 'b', 'c'];
    const { result } = renderHook(() => useAccountOrder(accountIds));

    act(() => {
      result.current.togglePin('b');
    });
    expect(result.current.orderedIds).toEqual(['b', 'a', 'c']);

    act(() => {
      result.current.moveId('a', 'c');
    });
    // Move happens within the merged order, but the pinned bucket still wins.
    expect(result.current.orderedIds).toEqual(['b', 'c', 'a']);
  });

  it('persists order and pins across a hook remount via localStorage', () => {
    const accountIds = ['a', 'b', 'c'];
    const first = renderHook(() => useAccountOrder(accountIds));

    act(() => {
      first.result.current.togglePin('c');
    });
    act(() => {
      first.result.current.moveId('a', 'b');
    });

    first.unmount();

    const second = renderHook(() => useAccountOrder(accountIds));
    expect(second.result.current.orderedIds).toEqual(first.result.current.orderedIds);
    expect(second.result.current.pinned.has('c')).toBe(true);
  });

  it('folds in unknown-but-present accountIds that are not yet in the persisted order', () => {
    const { result, rerender } = renderHook(({ accountIds }) => useAccountOrder(accountIds), {
      initialProps: { accountIds: ['a', 'b'] },
    });

    act(() => {
      result.current.moveId('a', 'b');
    });
    expect(result.current.orderedIds).toEqual(['b', 'a']);

    rerender({ accountIds: ['a', 'b', 'c'] });
    // 'c' is new/unknown to the persisted order — appended after known ids.
    expect(result.current.orderedIds).toEqual(['b', 'a', 'c']);
  });

  it('scopes persisted state per user, so a different user starts fresh', () => {
    const accountIds = ['a', 'b', 'c'];
    const first = renderHook(() => useAccountOrder(accountIds));
    act(() => {
      first.result.current.togglePin('c');
    });
    first.unmount();

    setCurrentUserId('test-user-2');
    const second = renderHook(() => useAccountOrder(accountIds));
    expect(second.result.current.orderedIds).toEqual(['a', 'b', 'c']);
    expect(second.result.current.pinned.size).toBe(0);
  });
});
