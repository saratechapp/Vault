import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { monthLabel, currentMonth, previousMonth, monthRange, findMonthMentions } from '../dateUtils.js';

// monthRange() builds its from/to boundaries with `new Date(year, month, 1)`
// (local time) and then serializes with toISOString() (UTC) — the day
// component only matches the intended local-calendar day when the test
// runner's timezone offset is 0. Pinning TZ to UTC here keeps the tests
// deterministic and asserts the function's intended contract; see the final
// report for a note on the underlying timezone bug (it shifts the returned
// dates by a day for any timezone east of UTC, e.g. the app's own default
// Asia/Kolkata — not something this test suite should paper over).
process.env.TZ = 'UTC';

describe('monthLabel', () => {
  it('capitalizes the month name and appends the year', () => {
    expect(monthLabel(2026, 0)).toBe('January 2026');
    expect(monthLabel(2026, 6)).toBe('July 2026');
    expect(monthLabel(2026, 11)).toBe('December 2026');
  });
});

describe('currentMonth / previousMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('currentMonth reflects the system clock', () => {
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z'));
    expect(currentMonth()).toEqual({ year: 2026, month: 6 });
  });

  it('previousMonth steps back within the same year', () => {
    expect(previousMonth({ year: 2026, month: 6 })).toEqual({ year: 2026, month: 5 });
  });

  it('previousMonth wraps from January to December of the prior year', () => {
    expect(previousMonth({ year: 2026, month: 0 })).toEqual({ year: 2025, month: 11 });
  });

  it('composes with currentMonth to get "last month" relative to now', () => {
    vi.setSystemTime(new Date('2026-01-15T00:00:00Z'));
    expect(previousMonth(currentMonth())).toEqual({ year: 2025, month: 11 });
  });
});

describe('monthRange', () => {
  it('returns the first and last day of the given month', () => {
    expect(monthRange(2026, 6)).toEqual({ dateFrom: '2026-07-01', dateTo: '2026-07-31' });
  });

  it('handles February in a leap year', () => {
    expect(monthRange(2028, 1)).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' });
  });

  it('handles February in a non-leap year', () => {
    expect(monthRange(2026, 1)).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' });
  });

  it('handles December (rolling into next year for the "to" boundary)', () => {
    expect(monthRange(2026, 11)).toEqual({ dateFrom: '2026-12-01', dateTo: '2026-12-31' });
  });
});

describe('findMonthMentions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T12:00:00Z')); // "now" = July 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('finds a single full month name mentioned in text', () => {
    expect(findMonthMentions('Show June expenses')).toEqual([{ year: 2026, month: 5 }]);
  });

  it('finds multiple months in reading order', () => {
    expect(findMonthMentions('Compare June vs July')).toEqual([
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ]);
  });

  it('preserves reading order even if the later month is named first', () => {
    expect(findMonthMentions('July compared to June')).toEqual([
      { year: 2026, month: 6 },
      { year: 2026, month: 5 },
    ]);
  });

  it('resolves a month that has not happened yet this year to last year', () => {
    // "now" is July 2026, so December hasn't happened yet this year.
    expect(findMonthMentions('What about December?')).toEqual([{ year: 2025, month: 11 }]);
  });

  it('resolves the current month itself to this year', () => {
    expect(findMonthMentions('Show July spending')).toEqual([{ year: 2026, month: 6 }]);
  });

  it('is case-insensitive', () => {
    expect(findMonthMentions('JUNE spending')).toEqual([{ year: 2026, month: 5 }]);
  });

  it('returns an empty array when no month is mentioned', () => {
    expect(findMonthMentions('Show my spending summary')).toEqual([]);
  });

  it('returns an empty array for empty text', () => {
    expect(findMonthMentions('')).toEqual([]);
  });

  it('matches a month name embedded as a substring of a longer word (documents keyword-only behavior)', () => {
    // "june" is a substring of "junebug" — the matcher is intentionally
    // simple/keyword-based (see the file's header comment), not word-boundary aware.
    expect(findMonthMentions('junebug report')).toEqual([{ year: 2026, month: 5 }]);
  });
});
