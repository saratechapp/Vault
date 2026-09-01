// Per-key in-process serialization queue. Chains async tasks for a given key
// so overlapping requests for the same key run one-at-a-time instead of
// concurrently — used to close check-then-act races where a read (remaining
// allowance) and the matching write (consume it) straddle an await and two
// parallel requests could both pass the check.
//
// This is the same pattern already used inline for bill-payment posting
// (runExclusiveForUserBills in routes/consumer.routes.js), lifted here so
// other routes can reuse it. The tail promise is always caught so one
// caller's rejected turn can't wedge the queue for the next caller.
//
// NOT a cross-process lock: a horizontally-scaled deployment still needs a
// DB-level atomic guard (a conditional UPDATE / RPC) for the same invariant.
// At the current single-instance scale this is sufficient and adds no
// infrastructure.
const queues = new Map();

function runExclusive(key, task) {
  const tail = (queues.get(key) || Promise.resolve()).catch(() => {});
  const result = tail.then(task);
  const settled = result.catch(() => {});
  queues.set(key, settled);
  settled.finally(() => {
    if (queues.get(key) === settled) queues.delete(key);
  });
  return result;
}

module.exports = { runExclusive };
