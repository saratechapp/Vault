const express = require('express');
const adminDb = require('../../adminDb');
const { requirePermission } = require('../../middleware/adminAuth');
const { computeAdminFeedbackNotifications } = require('../../services/notificationEngine');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

// Feedback-derived notifications for the admin topbar bell: brand-new
// untouched tickets, reopened tickets, and unread user replies. Not paged —
// the admin inbox is small enough (see adminDb.listFeedback's pageSize) that
// a flat "everything currently open" scan is simpler than a real feed table.
async function loadOpenTickets() {
  const { rows } = await adminDb.listFeedback({ pageSize: 100 });
  // 'resolved' is excluded too — the ball's in the user's court until they
  // confirm or reopen, so it's not something the admin bell needs to flag.
  const relevant = rows.filter((t) => t.status !== 'closed' && t.status !== 'resolved');
  return Promise.all(relevant.map(async (t) => ({
    id: t.id, subject: t.subject, status: t.status, priority: t.priority, createdAt: t.createdAt, adminLastReadAt: t.adminLastReadAt,
    latestMessage: await adminDb.getLatestFeedbackMessage(t.id),
  })));
}

router.get('/', requirePermission('feedback', 'view'), ah(async (req, res) => {
  const tickets = await loadOpenTickets();
  res.json(computeAdminFeedbackNotifications(tickets));
}));

// "Mark all read" only actually changes anything for the reply-driven
// notifications (reopened/brand-new tickets stay visible until acted on,
// same as the consumer-side "resolved" notification isn't dismissable
// either) — but stamping every open ticket is simple and harmless.
router.post('/read-all', requirePermission('feedback', 'view'), ah(async (req, res) => {
  const tickets = await loadOpenTickets();
  await Promise.all(tickets.map((t) => adminDb.markFeedbackAdminRead(t.id)));
  res.json({ ok: true });
}));

module.exports = router;
