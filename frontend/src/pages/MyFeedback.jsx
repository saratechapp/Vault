import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, MessageCircleQuestion } from 'lucide-react';
import { Card, Button, Chip, EmptyState } from '../components/ui/index.js';
import { feedbackApi, formatDate } from '../lib/api.js';
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, feedbackTypeLabel } from '../lib/feedback.js';
import { FeedbackFormModal } from '../components/feedback/FeedbackFormModal.jsx';
import { FeedbackThread } from '../components/feedback/FeedbackThread.jsx';
import { StarRating } from '../components/feedback/StarRating.jsx';

export default function MyFeedback() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDirectMessage, setShowDirectMessage] = useState(false);
  const selectedId = searchParams.get('id');

  function load() {
    setLoadError('');
    feedbackApi.list()
      .then((res) => setRows(res.rows || []))
      .catch((err) => setLoadError(err.message || 'Could not load your feedback.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openTicket(id) {
    setSearchParams({ id });
  }
  function backToList() {
    setSearchParams({});
    load();
  }

  if (selectedId) {
    return <FeedbackThread feedbackId={selectedId} onBack={backToList} />;
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-fg">My Feedback</p>
          <p className="text-sm text-muted">Track replies and status on everything you've reported.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<MessageCircleQuestion size={16} />} onClick={() => setShowDirectMessage(true)}>Message Super Admin</Button>
          <Button leftIcon={<Plus size={16} />} onClick={() => setShowForm(true)}>New feedback</Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : loadError ? (
        <EmptyState title="Couldn't load your feedback" body={loadError} action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No feedback yet"
          body="Reported a bug or requested a feature? It'll show up here with support's replies."
          action={<Button onClick={() => setShowForm(true)}>Send feedback</Button>}
        />
      ) : (
        <div className="space-y-2">
          {rows.map((t) => (
            <Card key={t.id} hover className="cursor-pointer" onClick={() => openTicket(t.id)}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-fg">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {feedbackTypeLabel(t.category)} · Submitted {formatDate(t.createdAt)} · Updated {formatDate(t.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {t.rating ? <StarRating value={t.rating} readOnly size={14} /> : null}
                  <Chip tone={FEEDBACK_STATUS_TONE[t.status] || 'neutral'}>{FEEDBACK_STATUS_LABEL[t.status] || t.status}</Chip>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <FeedbackFormModal open={showForm} onClose={() => setShowForm(false)} onSubmitted={load} />
      <FeedbackFormModal open={showDirectMessage} onClose={() => setShowDirectMessage(false)} directMessage onSubmitted={load} />
    </div>
  );
}
