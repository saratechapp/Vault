import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiggyBank, Receipt, Target, Sparkles, CheckCheck, X, BellOff, MessageCircle } from 'lucide-react';
import { Button, Card, Chip, EmptyState, IconButton } from '../components/ui/index.js';
import { notificationsApi, formatDate } from '../lib/api.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';

const TABS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'budget', label: 'Budget' },
  { value: 'bill', label: 'Bills' },
  { value: 'goal', label: 'Goals' },
  { value: 'insight', label: 'Insights' },
  { value: 'feedback', label: 'Feedback' },
];

const TYPE_ICON = { budget: PiggyBank, bill: Receipt, goal: Target, insight: Sparkles, feedback: MessageCircle };
const TYPE_LABEL = { budget: 'Budget', bill: 'Bill', goal: 'Goal', insight: 'Insight', feedback: 'Feedback' };
const TONE_RANK = { danger: 0, warning: 1, success: 2, info: 3 };

export default function Notifications() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [tab, setTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function load() {
    setLoadError('');
    try {
      const items = await notificationsApi.list();
      setList((items || []).sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]));
    } catch (err) {
      setLoadError(err.message || 'Could not load your notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useTxCreatedListener(load);

  const unreadCount = list.filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    if (tab === 'all') return list;
    if (tab === 'unread') return list.filter((n) => !n.read);
    return list.filter((n) => n.type === tab);
  }, [list, tab]);

  async function markRead(n) {
    await notificationsApi.update(n.id, { read: true });
    load();
  }
  async function dismiss(n) {
    await notificationsApi.remove(n.id);
    load();
  }
  async function openFeedback(n) {
    await markRead(n);
    navigate(`/app/feedback?id=${n.feedbackId}`);
  }
  async function markAllRead() {
    await notificationsApi.readAll();
    load();
  }

  if (loading) return <p className="text-sm text-muted">Loading notifications…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your notifications"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-fg">Notifications</p>
          <p className="text-sm text-muted">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}</p>
        </div>
        <Button variant="outline" size="sm" leftIcon={<CheckCheck size={14} />} onClick={markAllRead} disabled={unreadCount === 0}>Mark all read</Button>
      </Card>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const count = t.value === 'unread' ? unreadCount : t.value === 'all' ? list.length : list.filter((n) => n.type === t.value).length;
          return (
            <button
              key={t.value} onClick={() => setTab(t.value)}
              className={`chip text-xs font-medium transition ${tab === t.value ? 'border-brand-500/40 bg-brand-500/10 text-brand-500' : 'text-muted hover:text-fg'}`}
            >
              {t.label} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BellOff size={22} />}
          title="Nothing here"
          body={tab === 'unread' ? 'No unread notifications.' : 'No notifications match this filter.'}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => {
            const Icon = TYPE_ICON[n.type] || Sparkles;
            return (
              <Card key={n.id} className="group flex items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${n.read ? 'bg-tint/[0.06] text-subtle' : 'bg-brand-500/15 text-brand-500'}`}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />}
                    <p className="truncate text-sm font-semibold text-fg">{n.title}</p>
                    <Chip tone={n.tone}>{TYPE_LABEL[n.type] || n.type}</Chip>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <p className="text-xs text-subtle">{formatDate(n.createdAt)}</p>
                    {n.feedbackId && (
                      <button type="button" onClick={() => openFeedback(n)} className="text-xs font-semibold text-brand-500 hover:underline">
                        {n.type === 'feedback' && n.title.startsWith('Issue resolved') ? 'Review Fix' : 'Open conversation'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  {!n.read && (
                    <IconButton icon={CheckCheck} label="Mark as read" title="Mark as read" onClick={() => markRead(n)} />
                  )}
                  <IconButton icon={X} variant="danger" label="Dismiss" title="Dismiss" onClick={() => dismiss(n)} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
