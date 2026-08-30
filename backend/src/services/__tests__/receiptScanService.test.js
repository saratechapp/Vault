const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  extractJson,
  normalizeResult,
  categoryOutline,
  toNumber,
  buildContextText,
} = require('../receiptScanService');

// ---------------------------------------------------------------------------
// extractJson
// ---------------------------------------------------------------------------

test('extractJson parses a bare JSON object', () => {
  assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
});

test('extractJson strips a ```json fence', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
});

test('extractJson digs the object out of surrounding prose', () => {
  assert.deepEqual(extractJson('Here you go:\n{"a":1}\nHope that helps.'), { a: 1 });
});

test('extractJson returns null on unparseable / missing JSON', () => {
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('{ not: valid }'), null);
  assert.equal(extractJson(''), null);
  assert.equal(extractJson(null), null);
});

// ---------------------------------------------------------------------------
// toNumber
// ---------------------------------------------------------------------------

test('toNumber strips currency symbols and thousands separators', () => {
  assert.equal(toNumber('₹1,200.50'), 1200.5);
  assert.equal(toNumber('$ 45,300'), 45300);
  assert.equal(toNumber(850), 850);
  assert.equal(toNumber('-20'), -20);
});

test('toNumber returns null for unreadable input', () => {
  assert.equal(toNumber('abc'), null);
  assert.equal(toNumber(''), null);
  assert.equal(toNumber(null), null);
  assert.equal(toNumber('-'), null);
  assert.equal(toNumber(Infinity), null);
});

// ---------------------------------------------------------------------------
// normalizeResult — shape enforcement
// ---------------------------------------------------------------------------

const TXN_KEYS = [
  'merchant', 'amount', 'currency', 'date', 'time', 'type', 'paymentMethod',
  'categoryName', 'subcategoryName', 'referenceId', 'invoiceNumber',
  'subtotal', 'tax', 'discount', 'note',
];

test('normalizeResult always emits every transaction key as { value, confidence }', () => {
  const r = normalizeResult({}, { imageCount: 3 });
  assert.deepEqual(Object.keys(r.transaction).sort(), [...TXN_KEYS].sort());
  for (const k of TXN_KEYS) {
    assert.deepEqual(r.transaction[k], { value: null, confidence: 'low' }, k);
  }
  assert.deepEqual(r.lineItems, []);
  assert.equal(r.sourceKind, 'other');
  assert.equal(r.imageCount, 3);
  assert.deepEqual(r.warnings, []);
});

test('normalizeResult coerces numbers and preserves a high confidence on a real value', () => {
  const r = normalizeResult({
    transaction: {
      amount: { value: '₹1,200.50', confidence: 'high' },
      subtotal: { value: 'not a number', confidence: 'high' },
    },
  }, { imageCount: 1 });
  assert.deepEqual(r.transaction.amount, { value: 1200.5, confidence: 'high' });
  assert.deepEqual(r.transaction.subtotal, { value: null, confidence: 'low' });
});

test('normalizeResult downgrades confidence to low whenever the value is null', () => {
  const r = normalizeResult({
    transaction: { merchant: { value: null, confidence: 'high' } },
  }, {});
  assert.deepEqual(r.transaction.merchant, { value: null, confidence: 'low' });
});

test('normalizeResult treats an unknown confidence as low', () => {
  const r = normalizeResult({
    transaction: { merchant: { value: 'Shop', confidence: 'medium' } },
  }, {});
  assert.deepEqual(r.transaction.merchant, { value: 'Shop', confidence: 'low' });
});

test('normalizeResult accepts a bare (unwrapped) field value', () => {
  const r = normalizeResult({ transaction: { merchant: 'Corner Store' } }, {});
  assert.deepEqual(r.transaction.merchant, { value: 'Corner Store', confidence: 'low' });
});

test('normalizeResult normalises currency to an ISO 4217 code or null', () => {
  assert.deepEqual(
    normalizeResult({ transaction: { currency: { value: 'inr', confidence: 'high' } } }, {}).transaction.currency,
    { value: 'INR', confidence: 'high' }
  );
  assert.deepEqual(
    normalizeResult({ transaction: { currency: { value: 'rupees', confidence: 'high' } } }, {}).transaction.currency,
    { value: null, confidence: 'low' }
  );
});

test('normalizeResult rejects a malformed date and time', () => {
  const r = normalizeResult({
    transaction: {
      date: { value: '30-08-2026', confidence: 'high' },
      time: { value: '7:5 pm', confidence: 'high' },
    },
  }, {});
  assert.deepEqual(r.transaction.date, { value: null, confidence: 'low' });
  assert.deepEqual(r.transaction.time, { value: null, confidence: 'low' });
});

test('normalizeResult keeps a well-formed date and 24h time', () => {
  const r = normalizeResult({
    transaction: {
      date: { value: '2026-08-30', confidence: 'high' },
      time: { value: '19:42', confidence: 'low' },
    },
  }, {});
  assert.equal(r.transaction.date.value, '2026-08-30');
  assert.equal(r.transaction.time.value, '19:42');
});

test('normalizeResult clamps type to expense | income', () => {
  assert.equal(
    normalizeResult({ transaction: { type: { value: 'refund', confidence: 'high' } } }, {}).transaction.type.value,
    null
  );
  assert.equal(
    normalizeResult({ transaction: { type: { value: 'income', confidence: 'high' } } }, {}).transaction.type.value,
    'income'
  );
});

test('normalizeResult sanitises lineItems: drops nameless rows, coerces qty/amount', () => {
  const r = normalizeResult({
    lineItems: [
      { name: 'Paneer Tikka', qty: '1', amount: '₹320' },
      { name: '', qty: 2, amount: 100 },
      { qty: 5, amount: 5 },
      { name: 'Chai', qty: null, amount: null },
    ],
  }, {});
  assert.deepEqual(r.lineItems, [
    { name: 'Paneer Tikka', qty: 1, amount: 320 },
    { name: 'Chai', qty: null, amount: null },
  ]);
});

test('normalizeResult passes through a valid sourceKind and defaults the rest to other', () => {
  assert.equal(normalizeResult({ sourceKind: 'phonepe' }, {}).sourceKind, 'phonepe');
  assert.equal(normalizeResult({ sourceKind: 'venmo' }, {}).sourceKind, 'other');
});

test('normalizeResult keeps imageCount from the caller, not the model', () => {
  const r = normalizeResult({ imageCount: 99 }, { imageCount: 2 });
  assert.equal(r.imageCount, 2);
});

test('normalizeResult trims and caps warnings', () => {
  const r = normalizeResult({ warnings: ['  hi  ', '', 123, ...Array(20).fill('x')] }, {});
  assert.equal(r.warnings[0], 'hi');
  assert.ok(r.warnings.length <= 10);
});

// ---------------------------------------------------------------------------
// categoryOutline / buildContextText
// ---------------------------------------------------------------------------

test('categoryOutline nests children under their parent by name', () => {
  const cats = [
    { id: 'p1', name: 'Food & Dining', parentId: null },
    { id: 'c1', name: 'Restaurant', parentId: 'p1' },
    { id: 'c2', name: 'Groceries', parentId: 'p1' },
    { id: 'p2', name: 'Transport', parentId: null },
  ];
  const out = categoryOutline(cats);
  assert.match(out, /- Food & Dining/);
  assert.match(out, /- Restaurant {2}\(under Food & Dining\)/);
  assert.match(out, /- Transport/);
});

test('categoryOutline handles an empty list', () => {
  assert.equal(categoryOutline([]), '(none configured)');
});

test('buildContextText surfaces the hints and the category names', () => {
  const text = buildContextText(
    { todayISO: '2026-08-30', localeTag: 'en-IN', defaultCurrency: 'INR' },
    [{ id: 'p1', name: 'Food & Dining', parentId: null }],
    2
  );
  assert.match(text, /2026-08-30/);
  assert.match(text, /INR/);
  assert.match(text, /Food & Dining/);
  assert.match(text, /2 image\(s\) follow/);
});
