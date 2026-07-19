import { describe, it, expect } from 'vitest';
import { buildBalanceLedger, statementFor } from '../Transactions.jsx';

const ACCOUNTS = [
  { id: 'checking', openingBalance: 1000 },
  { id: 'savings', openingBalance: 500 },
];

// The API returns transactions newest-first (date desc). buildBalanceLedger
// is documented to reverse this internally to recover chronological order,
// so the fixture below is deliberately given newest-first, matching reality.
const TRANSACTIONS_NEWEST_FIRST = [
  // chronological order (oldest -> newest) is: t1 (income), t2 (expense), t3 (transfer)
  { id: 't3', type: 'transfer', date: '2026-01-03', fromAccountId: 'checking', toAccountId: 'savings', amount: 200 },
  { id: 't2', type: 'expense', date: '2026-01-02', accountId: 'checking', amount: -150 },
  { id: 't1', type: 'income', date: '2026-01-01', accountId: 'checking', amount: 300 },
];

describe('buildBalanceLedger', () => {
  it('reconstructs a running balance per account in chronological order despite newest-first input', () => {
    const ledger = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);

    // t1: income +300 on checking: 1000 -> 1300
    expect(ledger.get('t1')).toEqual({ accountId: 'checking', before: 1000, after: 1300 });

    // t2: expense -150 on checking: 1300 -> 1150
    expect(ledger.get('t2')).toEqual({ accountId: 'checking', before: 1300, after: 1150 });

    // t3: transfer 200 checking -> savings: checking 1150 -> 950, savings 500 -> 700
    expect(ledger.get('t3')).toEqual({
      from: { accountId: 'checking', before: 1150, after: 950 },
      to: { accountId: 'savings', before: 500, after: 700 },
    });
  });

  it('produces the same result regardless of whether the input array is already sorted', () => {
    const chronological = [...TRANSACTIONS_NEWEST_FIRST].reverse();
    const ledgerFromNewestFirst = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);
    const ledgerFromChronological = buildBalanceLedger(chronological, ACCOUNTS);
    // buildBalanceLedger always reverses its input, so if we hand it
    // already-chronological data it will process it backwards (oldest last)
    // — this test documents that the function expects newest-first input,
    // rather than being order-agnostic.
    expect(ledgerFromNewestFirst.get('t1')).not.toEqual(ledgerFromChronological.get('t1'));
  });

  it('leaves before/after null for a transaction whose account is not in the accounts list', () => {
    const txns = [{ id: 'tx-unknown', type: 'expense', date: '2026-01-01', accountId: 'ghost-account', amount: -50 }];
    const ledger = buildBalanceLedger(txns, ACCOUNTS);
    expect(ledger.get('tx-unknown')).toEqual({ accountId: 'ghost-account', before: null, after: null });
  });
});

describe('statementFor', () => {
  it('returns the previous/current balance for a plain (non-transfer) transaction', () => {
    const ledger = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);
    const t1 = TRANSACTIONS_NEWEST_FIRST.find((t) => t.id === 't1');
    const stmt = statementFor(t1, ledger, null);
    expect(stmt).toEqual({ previousBalance: 1000, currentBalance: 1300, displayAmount: 300 });
  });

  it('reports the paying (from) side of a transfer by default (no context account)', () => {
    const ledger = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);
    const t3 = TRANSACTIONS_NEWEST_FIRST.find((t) => t.id === 't3');
    const stmt = statementFor(t3, ledger, null);
    // from = checking, which lost money: displayAmount negative
    expect(stmt).toEqual({ previousBalance: 1150, currentBalance: 950, displayAmount: -200 });
  });

  it('reports the receiving (to) side of a transfer when the context account is the receiving account', () => {
    const ledger = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);
    const t3 = TRANSACTIONS_NEWEST_FIRST.find((t) => t.id === 't3');
    const stmt = statementFor(t3, ledger, 'savings');
    // to = savings, which gained money: displayAmount positive
    expect(stmt).toEqual({ previousBalance: 500, currentBalance: 700, displayAmount: 200 });
  });

  it('still reports the from side when the context account is the from account itself', () => {
    const ledger = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);
    const t3 = TRANSACTIONS_NEWEST_FIRST.find((t) => t.id === 't3');
    const stmt = statementFor(t3, ledger, 'checking');
    expect(stmt).toEqual({ previousBalance: 1150, currentBalance: 950, displayAmount: -200 });
  });

  it('returns nulls with the raw amount for a transaction id missing from the ledger', () => {
    const ledger = buildBalanceLedger(TRANSACTIONS_NEWEST_FIRST, ACCOUNTS);
    const stmt = statementFor({ id: 'not-in-ledger', amount: 42 }, ledger, null);
    expect(stmt).toEqual({ previousBalance: null, currentBalance: null, displayAmount: 42 });
  });
});
