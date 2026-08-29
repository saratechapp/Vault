const { addDaysFromToday, round1 } = require('./shared');

// Pending bills due within a window — a small shared helper for *new* code
// only (ForecastService's low-balance alert, future notification/search
// work). Not retrofitted into the three existing inline "bills due soon"
// filters already in server.js (dashboard's upcomingBills slice,
// computeDailySummary's billsThisMonth block, computeGeneratedRows' bill
// loop) — each has a slightly different window/shape today, and changing
// three existing, working call sites at once is unnecessary risk for this
// pass. Unifying them is a reasonable later cleanup, not part of this one.
function upcomingBills(userData, { days = 30 } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const until = addDaysFromToday(days);
  return (userData.bills || [])
    .filter((b) => b.status === 'pending')
    .filter((b) => {
      const d = new Date(b.dueDate);
      return d >= today && d <= until;
    })
    .map((b) => ({ id: b.id, name: b.name, amount: Math.abs(b.amount), dueDate: b.dueDate, type: b.type }))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

// On-time/late payment history from the bill_payments log (0007_bill_payments.sql).
// Only starts accumulating from the day that migration shipped — there's no
// way to backfill "was last month's rent late" for existing users, since the
// due date at that time was never recorded before now. Returns
// insufficientData the same way computeSmartSavings does when there's
// nothing reliable to compute from yet, rather than reporting a misleading
// 100% on-time rate off a near-empty log.
function computeBillPaymentHistory(userData, { months = 6, minPayments = 3 } = {}) {
  const since = addDaysFromToday(-months * 30);
  const recent = (userData.billPayments || []).filter((p) => new Date(p.paidDate) >= since);
  if (recent.length < minPayments) return { insufficientData: true };
  const onTimeCount = recent.filter((p) => !p.wasLate).length;
  const lateCount = recent.length - onTimeCount;
  return {
    totalPayments: recent.length,
    onTimeCount,
    lateCount,
    onTimeRate: round1((onTimeCount / recent.length) * 100),
  };
}

module.exports = {
  upcomingBills,
  computeBillPaymentHistory,
};
