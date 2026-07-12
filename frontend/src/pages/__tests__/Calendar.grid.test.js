import { describe, it, expect } from 'vitest';
import {
  pad2, dateKey, keyToDate, addDays, addMonths, startOfWeek,
  buildMonthGrid, buildWeekGrid, weekLabel, summarize,
} from '../Calendar.jsx';

describe('pad2', () => {
  it('left-pads single digits with a zero', () => {
    expect(pad2(5)).toBe('05');
    expect(pad2(12)).toBe('12');
    expect(pad2(0)).toBe('00');
  });
});

describe('dateKey / keyToDate', () => {
  it('round-trips a date through dateKey and keyToDate', () => {
    const d = new Date(2026, 6, 5); // July 5 2026
    const key = dateKey(d);
    expect(key).toBe('2026-07-05');
    const back = keyToDate(key);
    expect(back.getFullYear()).toBe(2026);
    expect(back.getMonth()).toBe(6);
    expect(back.getDate()).toBe(5);
  });
});

describe('addDays', () => {
  it('adds days within the same month', () => {
    const d = addDays(new Date(2026, 6, 10), 5);
    expect(dateKey(d)).toBe('2026-07-15');
  });

  it('rolls over into the next month/year across Dec 31 + 1 day', () => {
    const d = addDays(new Date(2025, 11, 31), 1);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it('supports negative offsets (subtracting days)', () => {
    const d = addDays(new Date(2026, 0, 1), -1);
    expect(dateKey(d)).toBe('2025-12-31');
  });
});

describe('addMonths', () => {
  it('always resets to the 1st of the resulting month, regardless of the source day-of-month', () => {
    const d = addMonths(new Date(2025, 11, 31), 1); // Dec 31, 2025 + 1 month
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0); // January
    expect(d.getDate()).toBe(1);
  });

  it('rolls back across a year boundary with a negative offset', () => {
    const d = addMonths(new Date(2026, 0, 15), -1);
    expect(d.getFullYear()).toBe(2025);
    expect(d.getMonth()).toBe(11); // December
    expect(d.getDate()).toBe(1);
  });
});

describe('startOfWeek', () => {
  // Implementation is `r.setDate(r.getDate() - r.getDay())`, i.e. it walks
  // back to the most recent Sunday (getDay() === 0) — a Sunday-start week,
  // matching this file's WEEKDAYS = ['Sun', 'Mon', ..., 'Sat'] ordering.
  it('walks a mid-week date back to the preceding Sunday', () => {
    const wed = new Date(2026, 6, 15); // Wed July 15 2026
    expect(wed.getDay()).toBe(3);
    const start = startOfWeek(wed);
    expect(dateKey(start)).toBe('2026-07-12');
    expect(start.getDay()).toBe(0);
  });

  it('leaves a Sunday unchanged (Sunday is treated as the start of its own week, not the prior week)', () => {
    const sun = new Date(2026, 6, 12); // Sunday July 12 2026
    expect(sun.getDay()).toBe(0);
    const start = startOfWeek(sun);
    expect(dateKey(start)).toBe('2026-07-12');
  });
});

describe('buildMonthGrid', () => {
  it('produces correct leading/trailing padding and a cell count that is a multiple of 7 for a month starting mid-week', () => {
    // July 1 2026 is a Wednesday (getDay() === 3), so 3 leading padding
    // days from June are expected.
    const grid = buildMonthGrid(new Date(2026, 6, 10));
    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(35);

    const leading = grid.filter((c) => !c.inMonth && c.date.getMonth() === 5);
    expect(leading).toHaveLength(3);
    expect(leading[0].key).toBe('2026-06-28');

    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31); // July has 31 days
    expect(inMonth[0].key).toBe('2026-07-01');
    expect(inMonth[inMonth.length - 1].key).toBe('2026-07-31');

    const trailing = grid.filter((c) => !c.inMonth && c.date.getMonth() === 7);
    expect(trailing).toHaveLength(1);
    expect(trailing[0].key).toBe('2026-08-01');
  });

  it('handles a leap-year February correctly (29 in-month days)', () => {
    const grid = buildMonthGrid(new Date(2024, 1, 15)); // Feb 2024, leap year
    expect(grid.length % 7).toBe(0);
    expect(grid.length).toBe(35);

    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(29);
    expect(inMonth[0].key).toBe('2024-02-01');
    expect(inMonth[inMonth.length - 1].key).toBe('2024-02-29');

    // Feb 1 2024 is a Thursday (getDay() === 4) -> 4 leading padding days.
    const leading = grid.filter((c) => !c.inMonth && c.date < new Date(2024, 1, 1));
    expect(leading).toHaveLength(4);
  });

  it('handles a non-leap-year February correctly (28 in-month days)', () => {
    const grid = buildMonthGrid(new Date(2026, 1, 15)); // Feb 2026, not a leap year
    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(28);
  });
});

describe('buildWeekGrid', () => {
  it('returns exactly 7 days starting from the Sunday of the given week', () => {
    const week = buildWeekGrid(new Date(2026, 6, 15)); // Wed July 15 2026
    expect(week).toHaveLength(7);
    expect(week[0].key).toBe('2026-07-12');
    expect(week[6].key).toBe('2026-07-18');
  });
});

describe('weekLabel', () => {
  it('formats a week fully within one month as "Mon DD – DD, YYYY"', () => {
    const week = buildWeekGrid(new Date(2026, 6, 15));
    expect(weekLabel(week)).toBe('Jul 12 – 18, 2026');
  });

  it('formats a week crossing a month boundary with both months named', () => {
    const week = buildWeekGrid(new Date(2026, 6, 30));
    expect(week[0].key).toBe('2026-07-26');
    expect(week[6].key).toBe('2026-08-01');
    expect(weekLabel(week)).toBe('Jul 26 – Aug 1, 2026');
  });
});

describe('summarize', () => {
  it('sums income, expense (absolute), and transfer (absolute) and computes net/count', () => {
    const list = [
      { type: 'income', amount: 1000 },
      { type: 'expense', amount: -300 },
      { type: 'expense', amount: -50 },
      { type: 'transfer', amount: 200 },
    ];
    const result = summarize(list);
    expect(result).toEqual({ income: 1000, expense: 350, transfer: 200, net: 650, count: 4 });
  });

  it('returns all zeros for an empty list', () => {
    expect(summarize([])).toEqual({ income: 0, expense: 0, transfer: 0, net: 0, count: 0 });
  });
});
