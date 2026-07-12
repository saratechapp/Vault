import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Target, Flame, X, History, ArrowRight } from 'lucide-react';
import { Button, Card, ProgressBar, Chip, Modal, ConfirmDialog, IconButton, Field, Input, EmptyState, DynamicIcon, RequiredLabel, IconSelect } from '../components/ui/index.js';
import { goalsApi, accountsApi, transactionsApi, formatCurrency, formatDate } from '../lib/api.js';
import { useTxCreatedListener, notifyTxCreated } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { MandatoryAccountGate } from '../components/MandatoryAccountGate.jsx';

// Same quick-tag set as the New Transaction / Add Bill modals' Tags pills.
const QUICK_TAGS = ['Savings', 'Investment', 'Protection', 'Expenditure', 'Income'];

function nowLocalDatetime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const GOAL_COLORS = ['#6366f1', '#22d3ee', '#a855f7', '#ec4899', '#84cc16', '#f59e0b', '#f43f5e', '#14b8a6', '#0ea5e9', '#f97316'];

// Dec 31 of the current year — filled in on-demand by the "This year end"
// quick-pick chip next to the Deadline field, not as a silent default.
function endOfThisYearIso() {
  return `${new Date().getFullYear()}-12-31`;
}

function blankForm() {
  return { name: '', target: '', saved: '', deadline: '', priority: 'medium', monthlyContribution: '', note: '', color: GOAL_COLORS[0] };
}

function monthsUntil(dateStr) {
  if (!dateStr) return 1;
  const now = new Date();
  const then = new Date(dateStr);
  const months = (then.getFullYear() - now.getFullYear()) * 12 + (then.getMonth() - now.getMonth());
  return Math.max(1, months);
}

function GoalModal({ open, onClose, editing, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        name: editing.name, target: String(editing.target), saved: String(editing.saved),
        deadline: editing.deadline || '', priority: editing.priority || 'medium',
        monthlyContribution: String(editing.monthlyContribution || ''), note: editing.note || '',
        color: editing.color || GOAL_COLORS[0],
      });
    } else {
      setForm(blankForm());
    }
  }, [open, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Please enter a goal name.');
    if (!(Number(form.target) > 0)) return setError('Please enter a target amount greater than 0.');
    if (Number(form.saved || 0) > Number(form.target)) return setError('Saved amount cannot exceed the target.');
    setSubmitting(true);
    try {
      const payload = {
        name: form.name, target: Number(form.target), saved: Number(form.saved) || 0,
        deadline: form.deadline || null, priority: form.priority,
        monthlyContribution: Number(form.monthlyContribution) || 0, note: form.note, color: form.color,
      };
      if (editing) await goalsApi.update(editing.id, payload);
      else await goalsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save this goal.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit goal' : 'New savings goal'} subtitle="Set a target and track your progress." size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <Field label="Goal name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency fund, Trip to Japan" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Target amount"><Input type="number" step="0.01" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="0.00" /></Field>
          <Field label="Saved so far"><Input type="number" step="0.01" value={form.saved} onChange={(e) => setForm((f) => ({ ...f, saved: e.target.value }))} placeholder="0.00" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Deadline">
            <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, deadline: endOfThisYearIso() }))}
              className="chip mt-1.5 text-subtle transition hover:border-line-strong hover:text-fg"
            >
              This year end
            </button>
          </Field>
          <Field label="Planned monthly contribution">
            <Input type="number" step="0.01" value={form.monthlyContribution} onChange={(e) => setForm((f) => ({ ...f, monthlyContribution: e.target.value }))} placeholder="Used to show 'On track' vs 'Behind pace'" />
          </Field>
        </div>
        <Field label="Priority">
          <div className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((p) => (
              <button key={p.value} type="button" onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                className={`rounded-xl border py-2 text-sm font-medium transition ${form.priority === p.value ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-line text-muted hover:bg-tint/[0.05]'}`}>
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Note"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional" /></Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {GOAL_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-8 w-8 rounded-lg transition ${form.color === c ? 'scale-110 border border-fg ring-2 ring-brand-500/40' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Create goal'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ContributeModal({ open, onClose, goal, accounts, onSaved }) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [date, setDate] = useState(nowLocalDatetime());
  const [note, setNote] = useState('');
  const [labels, setLabels] = useState([]);
  const [labelInput, setLabelInput] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setAccountId(accounts?.[0]?.id || '');
    setToAccountId(goal?.accountId || '');
    setDate(nowLocalDatetime());
    setNote('');
    setLabels([]);
    setLabelInput('');
    setError('');
    setFieldErrors({});
    setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, goal?.id]);

  if (!goal) return null;

  function addLabel(raw) {
    const clean = raw.trim();
    if (!clean || labels.includes(clean)) return;
    setLabels((l) => [...l, clean]);
    setLabelInput('');
  }
  function removeLabel(label) {
    setLabels((l) => l.filter((x) => x !== label));
  }

  const alreadyReached = goal.saved >= goal.target;
  const remaining = Math.max(0, goal.target - goal.saved);
  const amountNum = Number(amount) || 0;
  const cappedAmount = Math.min(amountNum, remaining);
  const projectedSaved = Math.min(goal.target, goal.saved + amountNum);
  const projectedPct = goal.target > 0 ? (projectedSaved / goal.target) * 100 : 0;
  const overshoot = amountNum > remaining && amountNum > 0;
  const reachesTarget = projectedSaved >= goal.target && amountNum > 0;

  function validate() {
    const errors = {};
    if (amountNum <= 0) errors.amount = 'Enter an amount greater than 0.';
    if (!accountId) errors.accountId = 'Select an account.';
    if (!toAccountId) errors.toAccountId = 'Select an account.';
    if (accountId && toAccountId && accountId === toAccountId) errors.toAccountId = 'From and To accounts must be different.';
    if (labels.length === 0) errors.labels = 'Select at least one tag or add a label.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
    try {
      await goalsApi.contribute(goal.id, {
        amount: amountNum, fromAccountId: accountId, toAccountId, date, labels,
        note: note.trim() || undefined,
      });
      notifyTxCreated();
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not add this contribution.');
    } finally {
      setSubmitting(false);
    }
  }

  const buttonLabel = alreadyReached ? 'Already reached' : submitting ? 'Saving…' : amountNum > 0 ? `Add ${formatCurrency(cappedAmount)}` : 'Add —';

  return (
    <Modal open={open} onClose={onClose} title="Contribute" subtitle={goal.name} size="sm">
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${goal.color}22`, color: goal.color }}>
          <DynamicIcon name={goal.icon || 'Target'} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{goal.name}</p>
          <p className="text-xs text-subtle">{formatCurrency(goal.saved)} of {formatCurrency(goal.target)}</p>
          <ProgressBar value={(goal.saved / goal.target) * 100} size="xs" color={goal.color} className="mt-1.5" />
        </div>
      </div>

      {alreadyReached ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-500">
          You've already hit this goal. Nice work!
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
          <Field label={<RequiredLabel>Amount to contribute</RequiredLabel>} error={fieldErrors.amount}>
            <Input ref={inputRef} type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {[500, 1000, 5000, 10000].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))} className="chip text-xs text-muted hover:text-fg">
                +{formatCurrency(v)}
              </button>
            ))}
            {remaining > 0 && (
              <button type="button" onClick={() => setAmount(String(remaining))} className="chip text-xs text-muted hover:text-fg">
                Max ({formatCurrency(remaining)})
              </button>
            )}
          </div>

          {amountNum > 0 && (
            <div className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">New balance</span>
                <span className="font-semibold text-fg">{formatCurrency(projectedSaved)} <span className="text-subtle">/ {formatCurrency(goal.target)}</span></span>
              </div>
              <ProgressBar value={projectedPct} size="sm" color={goal.color} className="mt-2" />
              <div className="mt-1.5 flex items-center justify-between text-xs">
                <span className="text-subtle">{projectedPct.toFixed(0)}% complete</span>
                {reachesTarget && <Chip tone="success">🎉 Target reached</Chip>}
              </div>
              {overshoot && <p className="mt-2 text-xs text-amber-500">Only {formatCurrency(remaining)} needed — extra will be ignored.</p>}
            </div>
          )}

          <Field label="Date & time">
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>

          <Field label={<RequiredLabel>From account</RequiredLabel>} error={fieldErrors.accountId} hint="This is booked as a transfer out of this account, not an expense — moving money into savings isn't spending it.">
            <IconSelect
              value={accountId} options={accounts || []} placeholder="Select account"
              onChange={setAccountId}
              renderIcon={(a) => (
                <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${a.color}22`, color: a.color }}>
                  <DynamicIcon name={a.icon} size={13} />
                </span>
              )}
            />
          </Field>

          <Field label={<RequiredLabel>To account</RequiredLabel>} error={fieldErrors.toAccountId} hint="Where this contribution is actually held — e.g. a dedicated savings or investment account.">
            <IconSelect
              value={toAccountId} options={(accounts || []).filter((a) => a.id !== accountId)} placeholder="Select account"
              onChange={setToAccountId}
              renderIcon={(a) => (
                <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${a.color}22`, color: a.color }}>
                  <DynamicIcon name={a.icon} size={13} />
                </span>
              )}
            />
          </Field>

          <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Goal contribution · ${goal.name}`} /></Field>

          <Field label={<RequiredLabel>Tags</RequiredLabel>} error={fieldErrors.labels}>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const active = labels.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => (active ? removeLabel(tag) : addLabel(tag))}
                    aria-pressed={active}
                    className={`chip text-xs transition ${active ? 'border-transparent bg-brand-500 text-white' : 'text-muted hover:text-fg'}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-subtle">
              Tag this "Savings" or "Investment" so it counts toward the savings line on your Cash flow chart.
            </p>
          </Field>

          <Field label="Labels">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface-2 p-2">
              {labels.map((l) => (
                <Chip key={l} tone="brand" className="gap-1">
                  {l}
                  <button type="button" onClick={() => removeLabel(l)} className="ml-0.5">
                    <X size={11} />
                  </button>
                </Chip>
              ))}
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addLabel(labelInput);
                  }
                }}
                placeholder="e.g. weekly, subscription, reimbursable"
                className="min-w-[100px] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-subtle"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || amountNum <= 0}>{buttonLabel}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function GoalHistoryModal({ open, onClose, goal, accounts, transactions }) {
  if (!goal) return null;
  const history = transactions
    .filter((t) => t.goalId === goal.id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  const accName = (id) => accounts.find((a) => a.id === id)?.name || '—';

  return (
    <Modal open={open} onClose={onClose} title="Contribution history" subtitle={goal?.name} size="md">
      {history.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No contributions recorded yet.</p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {history.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg">{formatCurrency(Math.abs(t.amount))}</span>
                <span className="text-xs text-subtle">{formatDate(t.date)}</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                {accName(t.fromAccountId)} <ArrowRight size={11} /> {accName(t.toAccountId)}
              </p>
              {t.note && <p className="mt-1 text-xs text-subtle">{t.note}</p>}
            </div>
          ))}
        </div>
      )}
      <div className="mt-5">
        <Button variant="outline" fullWidth onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [contributeGoal, setContributeGoal] = useState(null);
  const [historyGoal, setHistoryGoal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();

  async function load() {
    setLoadError('');
    try {
      const [list, accs, txns] = await Promise.all([goalsApi.list(), accountsApi.list(), transactionsApi.list()]);
      setGoals(list || []);
      setAccounts(accs || []);
      setTransactions(txns || []);
      return list || [];
    } catch (err) {
      setLoadError(err.message || 'Could not load your goals.');
      return [];
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useTxCreatedListener(load);

  useEffect(() => {
    if (loading) return;
    if (searchParams.get('add') === '1') {
      setEditing(null);
      setModalOpen(true);
      searchParams.delete('add');
      setSearchParams(searchParams, { replace: true });
    }
    const contributeId = searchParams.get('contribute');
    if (contributeId) {
      const g = goals.find((x) => x.id === contributeId);
      if (g) setContributeGoal(g);
      searchParams.delete('contribute');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goals]);

  const highestPriority = useMemo(() => {
    return [...goals].sort((a, b) => {
      const rank = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (rank !== 0) return rank;
      return b.saved / b.target - a.saved / a.target;
    })[0];
  }, [goals]);

  const totalSaved = useMemo(() => goals.reduce((s, g) => s + g.saved, 0), [goals]);
  const totalTarget = useMemo(() => goals.reduce((s, g) => s + g.target, 0), [goals]);
  const overallPct = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  async function handleDelete(id) {
    await goalsApi.remove(id);
    setConfirmDelete(null);
    load();
  }

  if (loading || !accountsLoaded) return <p className="text-sm text-muted">Loading goals…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your goals"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }
  if (!hasAccounts) return <MandatoryAccountGate />;

  return (
    <div className="space-y-6">
      <Card strong padding="lg" className="grid gap-6 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Total progress across {goals.length} goal{goals.length === 1 ? '' : 's'}</p>
          <p className="mt-1 font-display text-3xl font-bold text-fg">{formatCurrency(totalSaved)} <span className="text-base font-medium text-subtle">of {formatCurrency(totalTarget)}</span></p>
          <ProgressBar value={overallPct} size="lg" className="mt-3" />
          <p className="mt-2 text-xs text-subtle">
            {goals.length === 0 ? "Add your first goal to begin." : `${overallPct.toFixed(0)}% saved · Keep going!`}
          </p>
          <Button className="mt-5" leftIcon={<Plus size={15} />} onClick={() => { setEditing(null); setModalOpen(true); }}>New goal</Button>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-500"><Flame size={13} /> Highest priority</p>
          {highestPriority ? (
            <>
              <p className="mt-2 font-display text-lg font-semibold text-fg">{highestPriority.name}</p>
              <p className="text-sm text-muted">{((highestPriority.saved / highestPriority.target) * 100).toFixed(0)}% complete</p>
              <ProgressBar value={(highestPriority.saved / highestPriority.target) * 100} color={highestPriority.color} className="mt-2" />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No goals yet</p>
          )}
        </div>
      </Card>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target size={22} />} title="No savings goals yet" body="Set a target — an emergency fund, a trip, a laptop — and track it here."
          action={<Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>Add your first goal</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => {
            const pct = Math.min(100, (g.saved / g.target) * 100);
            const remaining = Math.max(0, g.target - g.saved);
            const months = monthsUntil(g.deadline);
            const monthlyNeed = Math.max(0, (g.target - g.saved) / months);
            const onTrack = (g.monthlyContribution || 0) >= monthlyNeed;
            return (
              <Card key={g.id} hover className="group">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${g.color}22`, color: g.color }}>
                    <DynamicIcon name={g.icon || 'Target'} size={20} />
                  </span>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <IconButton icon={Pencil} label="Edit" onClick={() => { setEditing(g); setModalOpen(true); }} />
                    <IconButton icon={Trash2} variant="danger" label="Delete" onClick={() => setConfirmDelete(g)} />
                  </div>
                </div>
                <p className="mt-3 font-display text-base font-semibold text-fg">{g.name}</p>
                <p className="text-xs capitalize text-subtle">{g.priority} priority</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-subtle">Saved</p>
                    <p className="font-display text-xl font-bold text-fg">{formatCurrency(g.saved)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-subtle">Target</p>
                    <p className="text-sm font-medium text-muted">{formatCurrency(g.target)}</p>
                  </div>
                </div>
                <ProgressBar value={pct} color={g.color} className="mt-2" />
                <p className="mt-1.5 text-xs text-subtle">{pct.toFixed(0)}% complete · {formatCurrency(remaining)} to go</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-tint/[0.04] p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-subtle">Deadline</p>
                    <p className="text-xs font-medium text-fg">{g.deadline ? formatDate(g.deadline) : 'No deadline'}</p>
                  </div>
                  <div className="rounded-lg bg-tint/[0.04] p-2 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-subtle">Monthly need</p>
                    <p className="text-xs font-medium text-fg">{formatCurrency(monthlyNeed)}</p>
                  </div>
                </div>
                <Chip tone={onTrack ? 'success' : 'warning'} className="mt-3">{onTrack ? 'On track' : 'Behind pace'}</Chip>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button size="sm" variant="outline" onClick={() => setContributeGoal(g)}>Contribute</Button>
                  <Button size="sm" variant="outline" leftIcon={<History size={13} />} onClick={() => setHistoryGoal(g)}>History</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <GoalModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={load} />
      <ContributeModal open={!!contributeGoal} onClose={() => setContributeGoal(null)} goal={contributeGoal} accounts={accounts} onSaved={load} />
      <GoalHistoryModal open={!!historyGoal} onClose={() => setHistoryGoal(null)} goal={historyGoal} accounts={accounts} transactions={transactions} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete goal?"
        subtitle="This can't be undone."
        body={<>Are you sure you want to delete <span className="font-semibold text-fg">{confirmDelete?.name}</span>?</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
