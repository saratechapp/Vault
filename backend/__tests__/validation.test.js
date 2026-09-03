const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanStr, boundedNumber, cleanLabels, cleanEntityText, STR_CAPS, MAX_MONEY,
} = require('../src/lib/validation');

test('cleanStr trims, strips control characters, and caps length', () => {
  assert.equal(cleanStr('  hello  ', 100), 'hello');
  assert.equal(cleanStr(`a${String.fromCharCode(0)}b${String.fromCharCode(9)}c${String.fromCharCode(127)}`, 100), 'abc');
  assert.equal(cleanStr('x'.repeat(500), 10).length, 10);
  assert.equal(cleanStr(1234, 10), '');
  assert.equal(cleanStr(null, 10), '');
  // Markup is NOT stripped — escaping is the consumer's responsibility.
  assert.equal(cleanStr('rent < 500 <b>x</b>', 100), 'rent < 500 <b>x</b>');
});

test('boundedNumber returns null for non-numbers and clamps magnitude', () => {
  assert.equal(boundedNumber('not-a-number'), null);
  assert.equal(boundedNumber(''), null);
  assert.equal(boundedNumber(undefined), null);
  assert.equal(boundedNumber('1,234.50'), 1234.5);
  assert.equal(boundedNumber(42), 42);
  assert.equal(boundedNumber(1e20), MAX_MONEY);
  assert.equal(boundedNumber(-1e20), -MAX_MONEY);
  assert.equal(boundedNumber(-5, { min: 0 }), 0);
  assert.equal(boundedNumber(250, { min: 0, max: 100 }), 100);
});

test('cleanLabels de-dupes, drops blanks/non-strings, caps count and item length', () => {
  assert.deepEqual(cleanLabels(['a', 'a', '', 'b', 123]), ['a', 'b']);
  assert.deepEqual(cleanLabels('nope'), []);
  const many = Array.from({ length: 50 }, (_, i) => `l${i}`);
  assert.equal(cleanLabels(many).length, 20);
  assert.equal(cleanLabels(['x'.repeat(200)])[0].length, STR_CAPS.label);
});

test('cleanEntityText mutates known text keys in place and leaves others alone', () => {
  const body = {
    name: `  ${'n'.repeat(200)}  `,
    note: 'x'.repeat(5000),
    vendor: `v${String.fromCharCode(0)}v`,
    amount: '12.50',
    categoryId: 'keep-me',
    labels: ['tag', 'tag', ''],
  };
  const out = cleanEntityText(body);
  assert.equal(out, body);
  assert.equal(out.name.length, STR_CAPS.name);
  assert.equal(out.note.length, STR_CAPS.note);
  assert.equal(out.vendor, 'vv');
  assert.equal(out.amount, '12.50'); // untouched — numeric validation is per-route
  assert.equal(out.categoryId, 'keep-me');
  assert.deepEqual(out.labels, ['tag']);
});

test('cleanEntityText tolerates a missing / non-object body', () => {
  assert.equal(cleanEntityText(undefined), undefined);
  assert.equal(cleanEntityText(null), null);
});
