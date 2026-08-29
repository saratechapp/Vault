const express = require('express');
const adminDb = require('../../adminDb');
const { requirePermission } = require('../../middleware/adminAuth');
const { recordAudit } = require('../../lib/adminAudit');
const { ah } = require('../../lib/asyncHandler');

const router = express.Router();

router.get('/', requirePermission('feedback', 'view'), ah(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 25));
  const { rows, total } = await adminDb.listFeedback({
    page, pageSize,
    status: req.query.status || '',
    priority: req.query.priority || '',
    category: req.query.category || '',
    assignedAdminId: req.query.assignedAdminId || '',
  });
  res.json({ rows, total, page, pageSize });
}));

router.get('/:id', requirePermission('feedback', 'view'), ah(async (req, res) => {
  const item = await adminDb.getFeedback(req.params.id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  const messages = await adminDb.listFeedbackMessages(req.params.id, { includeInternal: true });
  // Opening a ticket is what clears it from the topbar notification bell —
  // same "viewing is reading" convention as the consumer side.
  await adminDb.markFeedbackAdminRead(req.params.id);
  res.json({ ...item, messages });
}));

router.post('/:id/messages', requirePermission('feedback', 'edit'), ah(async (req, res) => {
  const item = await adminDb.getFeedback(req.params.id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  const { body, internal } = req.body || {};
  if (!body || !body.trim()) return res.status(400).json({ error: 'body_required' });
  const message = await adminDb.addFeedbackMessage({
    feedbackId: req.params.id, senderType: 'admin', adminSenderId: req.admin.id, body: body.trim(), internal: !!internal,
  });
  // A visible reply (not an internal note) implicitly moves a fresh ticket
  // into progress — matches how a support inbox naturally behaves.
  if (!internal && item.status === 'open') {
    await adminDb.updateFeedback(req.params.id, { status: 'in_progress' });
  }
  await recordAudit({ req, action: 'feedback.message', targetType: 'feedback', targetId: req.params.id, after: message });
  res.status(201).json(message);
}));

router.patch('/:id', requirePermission('feedback', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getFeedback(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const { status, priority, assignedAdminId } = req.body || {};
  const patch = {};
  if (status !== undefined) patch.status = status;
  if (priority !== undefined) patch.priority = priority;
  if (assignedAdminId !== undefined) patch.assignedAdminId = assignedAdminId;
  // Stamp resolution/closure timestamps off the same transition that drives
  // them elsewhere (assign/resolve endpoints, the user's confirm-fix route).
  if (status === 'resolved' && before.status !== 'resolved') patch.resolvedAt = new Date().toISOString();
  if (status === 'closed' && before.status !== 'closed') patch.closedAt = new Date().toISOString();
  const after = await adminDb.updateFeedback(req.params.id, patch);
  // A visible, timestamped timeline entry for every status change — the
  // spec's "each status update should include timestamp, admin name,
  // optional message" — without a separate history table.
  if (status !== undefined && status !== before.status) {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    await adminDb.addFeedbackMessage({
      feedbackId: req.params.id, senderType: 'system', adminSenderId: req.admin.id,
      body: note ? `Status changed to ${status}: ${note}` : `Status changed to ${status}.`,
      internal: false,
    });
  }
  await recordAudit({ req, action: 'feedback.update', targetType: 'feedback', targetId: req.params.id, before, after });
  res.json(after);
}));

router.post('/:id/assign', requirePermission('feedback', 'assign'), ah(async (req, res) => {
  const before = await adminDb.getFeedback(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const after = await adminDb.updateFeedback(req.params.id, {
    assignedAdminId: req.body?.adminId || null,
    status: before.status === 'open' ? 'assigned' : before.status,
  });
  await recordAudit({ req, action: 'feedback.assign', targetType: 'feedback', targetId: req.params.id, before, after });
  res.json(after);
}));

router.post('/:id/resolve', requirePermission('feedback', 'edit'), ah(async (req, res) => {
  const before = await adminDb.getFeedback(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  const after = await adminDb.updateFeedback(req.params.id, { status: 'resolved', resolvedAt: new Date().toISOString() });
  if (before.status !== 'resolved') {
    await adminDb.addFeedbackMessage({
      feedbackId: req.params.id, senderType: 'system', adminSenderId: req.admin.id,
      body: 'Status changed to resolved.', internal: false,
    });
  }
  await recordAudit({ req, action: 'feedback.resolve', targetType: 'feedback', targetId: req.params.id, before, after });
  res.json(after);
}));

// Actual deletion, distinct from Close/Resolve — restricted to Super Admin
// per the spec ("Delete (Super Admin)").
router.delete('/:id', requirePermission('feedback', 'delete'), ah(async (req, res) => {
  if (!req.admin.isSuperAdmin) return res.status(403).json({ error: 'forbidden' });
  const before = await adminDb.getFeedback(req.params.id);
  if (!before) return res.status(404).json({ error: 'not_found' });
  await adminDb.deleteFeedback(req.params.id);
  await recordAudit({ req, action: 'feedback.delete', targetType: 'feedback', targetId: req.params.id, before, after: null });
  res.status(204).end();
}));

module.exports = router;
