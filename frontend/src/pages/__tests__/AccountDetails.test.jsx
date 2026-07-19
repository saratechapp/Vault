import { describe, it, expect } from 'vitest';
import { ledgerForIds, buildAccountCategoryLedger } from '../AccountDetails.jsx';

const ACCOUNT_ID = 'acc1';

describe('ledgerForIds', () => {
  it('returns null when no transactions match the given category id set', () => {
    const result = ledgerForIds([{ categoryId: 'other', amount: 10 }], new Set(['c1']), ACCOUNT_ID);
    expect(result).toBeNull();
  });

  it('sums total/inflow/outflow correctly for a mix of income and expense rows', () => {
    const transactions = [
      { id: 't1', type: 'income', categoryId: 'c1', amount: 500, date: '2026-01-01', accountId: ACCOUNT_ID },
      { id: 't2', type: 'expense', categoryId: 'c1', amount: -200, date: '2026-01-02', accountId: ACCOUNT_ID },
      { id: 't3', type: 'expense', categoryId: 'c1', amount: -100, date: '2026-01-03', accountId: ACCOUNT_ID },
    ];
    const result = ledgerForIds(transactions, new Set(['c1']), ACCOUNT_ID);
    // total = sum of |amount| for all matching rows: 500 + 200 + 100 = 800
    expect(result.total).toBe(800);
    // inflow = income only: 500
    expect(result.inflow).toBe(500);
    // outflow = expenses only: 200 + 100 = 300
    expect(result.outflow).toBe(300);
    expect(result.count).toBe(3);
    // last = most recent by date (t3, |amount| = 100); previous = total - last
    expect(result.last).toBe(100);
    expect(result.previous).toBe(700);
    expect(result.lastDate).toBe('2026-01-03');
  });

  it('treats a transfer as inflow when this account is the receiving (to) side', () => {
    const transactions = [
      { id: 't1', type: 'transfer', categoryId: 'c1', amount: 300, date: '2026-01-01', fromAccountId: 'other', toAccountId: ACCOUNT_ID },
    ];
    const result = ledgerForIds(transactions, new Set(['c1']), ACCOUNT_ID);
    expect(result.inflow).toBe(300);
    expect(result.outflow).toBe(0);
  });

  it('treats a transfer as outflow when this account is the sending (from) side', () => {
    const transactions = [
      { id: 't1', type: 'transfer', categoryId: 'c1', amount: 300, date: '2026-01-01', fromAccountId: ACCOUNT_ID, toAccountId: 'other' },
    ];
    const result = ledgerForIds(transactions, new Set(['c1']), ACCOUNT_ID);
    expect(result.inflow).toBe(0);
    expect(result.outflow).toBe(300);
  });
});

describe('buildAccountCategoryLedger', () => {
  const categories = [
    { id: 'parent1', name: 'Food', icon: 'Utensils', color: '#111', parentId: null },
    { id: 'child1', name: 'Groceries', icon: 'ShoppingCart', color: '#222', parentId: 'parent1' },
    { id: 'child2', name: 'Dining out', icon: 'Utensils', color: '#333', parentId: 'parent1' },
    { id: 'transferCat', name: 'Transfer', icon: 'ArrowLeftRight', color: '#444', parentId: null },
  ];

  it('rolls up sub-category totals into the parent category total', () => {
    const transactions = [
      { id: 't1', type: 'expense', categoryId: 'child1', amount: -60, date: '2026-01-01', accountId: ACCOUNT_ID },
      { id: 't2', type: 'expense', categoryId: 'child2', amount: -40, date: '2026-01-02', accountId: ACCOUNT_ID },
    ];
    const ledger = buildAccountCategoryLedger(transactions, categories, ACCOUNT_ID);
    const food = ledger.find((c) => c.id === 'parent1');
    expect(food).toBeTruthy();
    // Parent total = sum of both children's transactions: 60 + 40 = 100
    expect(food.total).toBe(100);
    expect(food.children).toHaveLength(2);
    const groceries = food.children.find((c) => c.id === 'child1');
    const dining = food.children.find((c) => c.id === 'child2');
    expect(groceries.total).toBe(60);
    expect(dining.total).toBe(40);
  });

  it('buckets transfers between the user\'s own accounts under a distinct "Transfer" vendor breakdown, not mixed into income/expense categories', () => {
    const transactions = [
      { id: 't1', type: 'transfer', categoryId: 'transferCat', vendor: 'Health Insurance Premium', amount: 500, date: '2026-01-01', fromAccountId: ACCOUNT_ID, toAccountId: 'savings' },
      { id: 't2', type: 'transfer', categoryId: 'transferCat', vendor: 'Health Insurance Premium', amount: 500, date: '2026-02-01', fromAccountId: ACCOUNT_ID, toAccountId: 'savings' },
      { id: 't3', type: 'transfer', categoryId: 'transferCat', vendor: 'Electricity', amount: 120, date: '2026-01-05', fromAccountId: ACCOUNT_ID, toAccountId: 'savings' },
    ];
    const ledger = buildAccountCategoryLedger(transactions, categories, ACCOUNT_ID);
    const transferBucket = ledger.find((c) => c.id === 'transferCat');
    expect(transferBucket).toBeTruthy();
    // The generic Transfer category has no sub-categories, so it's broken
    // down by vendor instead — Health Insurance Premium and Electricity stay
    // distinct rather than collapsing into one lump "Transfer" total.
    expect(transferBucket.children).toHaveLength(2);
    const health = transferBucket.children.find((c) => c.name === 'Health Insurance Premium');
    const electricity = transferBucket.children.find((c) => c.name === 'Electricity');
    expect(health.total).toBe(1000);
    expect(electricity.total).toBe(120);
    // Vendor rows are sorted by total descending.
    expect(transferBucket.children[0].name).toBe('Health Insurance Premium');
  });

  it('excludes categories with zero matching transactions from the result', () => {
    const transactions = [
      { id: 't1', type: 'expense', categoryId: 'child1', amount: -10, date: '2026-01-01', accountId: ACCOUNT_ID },
    ];
    const ledger = buildAccountCategoryLedger(transactions, categories, ACCOUNT_ID);
    expect(ledger.find((c) => c.id === 'transferCat')).toBeUndefined();
  });
});
