import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Card, CardHeader, Chip, Button, Textarea, EmptyState } from '../ui/index.js';
import { StarRating } from './StarRating.jsx';
import { feedbackApi, formatDate } from '../../lib/api.js';
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, feedbackTypeLabel } from '../../lib/feedback.js';

const SENDER_LABEL = { admin: 'Support', user: 'You' };

function MessageBubble({ m }) {
  if (m.senderType === 'system') {
    return <p className="py-1 text-center text-xs text-subtle">{m.body} · {formatDate(m.createdAt)}</p>;
  }
  const mine = m.senderType === 'user';
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm ${mine ? 'bg-brand-500 text-white' : 'bg-tint/[0.06] text-fg'}`}>
        <p className="whitespace-pre-wrap">{m.body}</p>
        <p className={`mt-1 text-[11px] ${mine ? 'text-white/70' : 'text-subtle'}`}>{SENDER_LABEL[m.senderType] || m.senderType} · {formatDate(m.createdAt)}</p>
      </div>
    </div>
  );
}

// The confirm/reopen step — only shown once support marks a ticket resolved.
// Two exits: close it out with an optional satisfaction rating, or reopen
// with a note about what's still wrong. Both feed adminDb via POST .../confirm.
function ResolutionConfirm({ feedbackId, onDone }) {
  const [step, setStep] = useState(null); // null | 'fixed' | 'not_fixed'
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(confirmed) {
    setSending(true);
    try {
      await feedbackApi.confirm(feedbackId, { confirmed, rating: confirmed ? (rating || undefined) : undefined, comment: comment.trim() || undefined });
      onDone();
    } finally {
      setSending(false);
    }
  }

  if (!step) {
    return (
      <div className="mt-5 rounded-2xl border border-line bg-tint/[0.03] p-4 text-center">
        <p className="text-sm font-medium text-fg">Support marked this resolved — did it fix your issue?</p>
        <div className="mt-3 flex justify-center gap-3">
          <Button onClick={() => setStep('fixed')}>Yes, issue fixed</Button>
          <Button variant="outline" onClick={() => setStep('not_fixed')}>No, still having issue</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-line bg-tint/[0.03] p-4">
      {step === 'fixed' ? (
        <div>
          <p className="text-sm font-medium text-fg">How satisfied are you with the resolution?</p>
          <div className="mt-2"><StarRating value={rating} onChange={setRating} /></div>
        </div>
      ) : (
        <p className="text-sm font-medium text-fg">Tell us what's still wrong so support can take another look.</p>
      )}
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Optional comment…" />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setStep(null)} disabled={sending}>Back</Button>
        <Button onClick={() => submit(step === 'fixed')} disabled={sending}>
          {sending ? 'Submitting…' : step === 'fixed' ? 'Close ticket' : 'Reopen ticket'}
        </Button>
      </div>
    </div>
  );
}

export function FeedbackThread({ feedbackId, onBack }) {
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  function load() {
    feedbackApi.get(feedbackId).then(setItem).catch((err) => setError(err.message || 'Could not load this ticket.'));
  }
  useEffect(load, [feedbackId]);

  async function sendReply(e) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await feedbackApi.reply(feedbackId, reply.trim());
      setReply('');
      load();
    } catch (err) {
      setError(err.message || 'Could not send your reply.');
    } finally {
      setSending(false);
    }
  }

  if (error && !item) return <EmptyState title="Couldn't load this ticket" body={error} />;
  if (!item) return null;

  return (
    <div className="space-y-4">
      {onBack && (
        <button type="button" onClick={onBack} className="text-sm text-muted transition hover:text-fg">← Back to My Feedback</button>
      )}
      <Card padding="lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-fg">{item.subject}</p>
            <p className="mt-1 text-xs text-subtle">{feedbackTypeLabel(item.category)} · Submitted {formatDate(item.createdAt)}</p>
          </div>
          <Chip tone={FEEDBACK_STATUS_TONE[item.status] || 'neutral'}>{FEEDBACK_STATUS_LABEL[item.status] || item.status}</Chip>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{item.message}</p>
      </Card>

      <Card padding="lg">
        <CardHeader title="Conversation" />
        {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <div className="space-y-3">
          {(item.messages || []).map((m) => <MessageBubble key={m.id} m={m} />)}
          {(item.messages || []).length === 0 && <p className="text-sm text-muted">No replies yet.</p>}
        </div>

        {item.status === 'resolved' ? (
          <ResolutionConfirm feedbackId={item.id} onDone={load} />
        ) : (
          <form onSubmit={sendReply} className="mt-5 flex items-end gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder="Reply…" className="flex-1" />
            <Button type="submit" size="icon" disabled={sending || !reply.trim()} aria-label="Send reply"><Send size={16} /></Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default FeedbackThread;
