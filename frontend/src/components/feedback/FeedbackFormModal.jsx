import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Modal, Button, Field, Input, Select, Textarea } from '../ui/index.js';
import { StarRating } from './StarRating.jsx';
import { feedbackApi } from '../../lib/api.js';
import { FEEDBACK_TYPES, DIRECT_MESSAGE_CATEGORY } from '../../lib/feedback.js';

const EMPTY = { category: 'bug', subject: '', message: '', rating: 0, priority: 'normal' };

// Shared submission form — opened from the auto-popup, from Settings' Help
// panel, and from the "Message Super Admin" entry point (via `directMessage`,
// which pins the category and hides the type picker).
export function FeedbackFormModal({ open, onClose, directMessage = false, onSubmitted }) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function set(patch) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function handleClose() {
    setForm(EMPTY);
    setError('');
    setSubmitted(false);
    onClose?.();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      setError('Subject and description are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const created = await feedbackApi.create({
        ...form,
        category: directMessage ? DIRECT_MESSAGE_CATEGORY : form.category,
        rating: form.rating || undefined,
      });
      onSubmitted?.(created);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not send feedback.');
    } finally {
      setSaving(false);
    }
  }

  if (submitted) {
    return (
      <Modal open={open} onClose={handleClose} size="sm">
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-500">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-fg">Thanks — we've got it.</p>
            <p className="mt-1 text-sm text-muted">You can track its status any time from My Feedback.</p>
          </div>
          <Button onClick={handleClose} className="mt-1">Done</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={directMessage ? 'Message Super Admin' : 'Send feedback'}
      subtitle={directMessage ? 'Reach the Super Admin directly — questions, critical issues, suggestions.' : 'Report a bug, request a feature, or tell us what\'s not working.'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        {!directMessage && (
          <Field label="Feedback type">
            <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
              {FEEDBACK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Subject">
          <Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} maxLength={200} placeholder="Short summary" />
        </Field>
        <Field label="Description">
          <Textarea value={form.message} onChange={(e) => set({ message: e.target.value })} maxLength={5000} rows={5} placeholder="What happened? What did you expect instead?" />
        </Field>
        {!directMessage && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rating (optional)">
              <StarRating value={form.rating} onChange={(v) => set({ rating: v })} />
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
        )}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Sending…' : 'Send'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default FeedbackFormModal;
