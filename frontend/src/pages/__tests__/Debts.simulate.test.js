import { describe, it, expect } from 'vitest';
import { simulate } from '../Debts.jsx';

// Fixture: three debts with deliberately differing balance/APR rankings so
// avalanche (highest APR first) and snowball (smallest balance first)
// target extra payments in a different order and produce different results.
function fixtureDebts() {
  return [
    { name: 'A', balance: 5000, apr: 24, minPayment: 100 },
    { name: 'B', balance: 2000, apr: 12, minPayment: 50 },
    { name: 'C', balance: 8000, apr: 18, minPayment: 150 },
  ];
}

describe('simulate', () => {
  it('avalanche pays off debts in highest-APR-first order', () => {
    const result = simulate(fixtureDebts(), 1000, 'avalanche');
    // APR order desc: A(24) > C(18) > B(12)
    expect(result.payoffMonths).toBe(14);
    expect(result.totalInterest).toBe(1602);
    expect(result.timeline).toHaveLength(14);
    expect(result.timeline[result.timeline.length - 1].total).toBe(0);
    expect(result.payoffDate).toBeInstanceOf(Date);
  });

  it('snowball pays off debts in smallest-balance-first order', () => {
    const result = simulate(fixtureDebts(), 1000, 'snowball');
    // Balance order asc: B(2000) < A(5000) < C(8000)
    expect(result.payoffMonths).toBe(14);
    expect(result.totalInterest).toBe(1801);
  });

  it('avalanche produces lower or equal total interest than snowball for the same debt set', () => {
    const avalanche = simulate(fixtureDebts(), 1000, 'avalanche');
    const snowball = simulate(fixtureDebts(), 1000, 'snowball');
    // Avalanche always routes extra payments to the highest-APR balance
    // first, so it mathematically minimizes total interest paid.
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
    expect(avalanche.totalInterest).toBe(1602);
    expect(snowball.totalInterest).toBe(1801);
  });

  // `simulate` only returns the aggregate per-month `total` balance, not a
  // per-debt breakdown, so the payoff-order assertions below pin down the
  // aggregate `total` at the exact months where a debt reaches zero — those
  // milestone totals were independently derived by tracing the same
  // (unmodified) algorithm's per-debt balances offline, confirming:
  //   avalanche order: A (highest APR 24%, zero by month 5) -> C (18%, by
  //   month 13) -> B (12%, by month 14).
  it('avalanche pays off the highest-APR debt (A) first: month 5 total matches B+C remaining, A already at 0', () => {
    const result = simulate(fixtureDebts(), 1000, 'avalanche');
    expect(result.timeline[4].total).toBe(9488); // month 5: only B+C remain
    expect(result.timeline[4].month).toBe(5);
  });

  it('avalanche pays off the second-highest-APR debt (C) next: month 13 total matches only B remaining', () => {
    const result = simulate(fixtureDebts(), 1000, 'avalanche');
    expect(result.timeline[12].total).toBe(586); // month 13: only B remains (A and C at 0)
    expect(result.timeline[12].month).toBe(13);
  });

  // snowball order: B (smallest balance 2000, zero by month 2) -> A (5000,
  // by month 7) -> C (8000, by month 14) — the opposite priority from avalanche.
  it('snowball pays off the smallest-balance debt (B) first: month 2 total matches only A+C remaining', () => {
    const result = simulate(fixtureDebts(), 1000, 'snowball');
    expect(result.timeline[1].total).toBe(12869); // month 2: only A+C remain
    expect(result.timeline[1].month).toBe(2);
  });

  it('snowball pays off the second-smallest debt (A) next: month 7 total matches only C remaining', () => {
    const result = simulate(fixtureDebts(), 1000, 'snowball');
    expect(result.timeline[6].total).toBe(7499); // month 7: only C remains (A and B at 0)
    expect(result.timeline[6].month).toBe(7);
  });

  it('resolves eventually (hits the 480-month cap) when extraMonthly is 0 and minimums cannot outpace interest', () => {
    const result = simulate(fixtureDebts(), 0, 'avalanche');
    expect(result.payoffMonths).toBe(480);
    expect(result.timeline).toHaveLength(480);
    expect(result.totalInterest).toBe(56782);
    // With extraMonthly 0, avalanche and snowball only differ in which of the
    // affordable debts (B, C) get extra — since there is no extra, both
    // strategies behave identically.
    const snowballZero = simulate(fixtureDebts(), 0, 'snowball');
    expect(snowballZero.payoffMonths).toBe(480);
    expect(snowballZero.totalInterest).toBe(result.totalInterest);
  });

  it('resolves a single small debt with extraMonthly 0 well before the cap', () => {
    const result = simulate([{ name: 'X', balance: 100, apr: 5, minPayment: 20 }], 0, 'avalanche');
    expect(result.payoffMonths).toBe(6);
    expect(result.totalInterest).toBe(1);
    expect(result.payoffMonths).toBeLessThan(480);
  });

  it('never lets a debt balance go negative in the timeline totals', () => {
    const result = simulate(fixtureDebts(), 1000, 'avalanche');
    result.timeline.forEach((point) => {
      expect(point.total).toBeGreaterThanOrEqual(0);
    });
  });
});
