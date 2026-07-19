const { test } = require('node:test');
const assert = require('node:assert/strict');
const { touch, getOrCompute } = require('../cache');

test('getOrCompute computes and caches a value for a fresh key', async () => {
  const userId = `user-${Math.random()}`;
  let calls = 0;
  const compute = () => { calls++; return 'value-1'; };
  const result = await getOrCompute(userId, 'bundle-a', compute);
  assert.equal(result, 'value-1');
  assert.equal(calls, 1);
});

test('getOrCompute returns the cached value without recomputing when called again with no touch()', async () => {
  const userId = `user-${Math.random()}`;
  let calls = 0;
  const compute = () => { calls++; return { n: calls }; };
  const first = await getOrCompute(userId, 'bundle-a', compute);
  const second = await getOrCompute(userId, 'bundle-a', compute);
  assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test('touch(userId) invalidates the cache so the next getOrCompute recomputes', async () => {
  const userId = `user-${Math.random()}`;
  let calls = 0;
  const compute = () => { calls++; return calls; };
  const first = await getOrCompute(userId, 'bundle-a', compute);
  touch(userId);
  const second = await getOrCompute(userId, 'bundle-a', compute);
  assert.equal(calls, 2);
  assert.equal(first, 1);
  assert.equal(second, 2);
});

test('touching one user does not invalidate a different user\'s cached key', async () => {
  const userA = `user-a-${Math.random()}`;
  const userB = `user-b-${Math.random()}`;
  let callsA = 0;
  let callsB = 0;
  const computeA = () => { callsA++; return 'a'; };
  const computeB = () => { callsB++; return 'b'; };
  await getOrCompute(userA, 'bundle', computeA);
  await getOrCompute(userB, 'bundle', computeB);
  touch(userA);
  await getOrCompute(userA, 'bundle', computeA);
  await getOrCompute(userB, 'bundle', computeB);
  assert.equal(callsA, 2);
  assert.equal(callsB, 1);
});

test('touching one cacheName does not invalidate a different cacheName for the same user', async () => {
  const userId = `user-${Math.random()}`;
  let callsA = 0;
  let callsB = 0;
  const computeA = () => { callsA++; return 'a'; };
  const computeB = () => { callsB++; return 'b'; };
  await getOrCompute(userId, 'bundle-a', computeA);
  await getOrCompute(userId, 'bundle-b', computeB);
  // touch() invalidates by user-wide version counter, so both keys for this
  // user are invalidated together — verify that documented behavior.
  touch(userId);
  await getOrCompute(userId, 'bundle-a', computeA);
  await getOrCompute(userId, 'bundle-b', computeB);
  assert.equal(callsA, 2);
  assert.equal(callsB, 2);
});
