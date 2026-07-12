import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, Zap, Pause, Play, CheckCircle2, Clock3, CalendarClock, Wallet, Receipt, Info,
  ArrowDownRight, ArrowUpRight, ArrowLeftRight, X,
} from 'lucide-react';
import { Button, Card, KpiCard, Chip, Modal, ConfirmDialog, IconButton, Field, Input, Select, EmptyState, Alert, Tooltip, RequiredLabel, IconSelect, DynamicIcon } from '../components/ui/index.js';
import { billsApi, categoriesApi, accountsApi, formatCurrency, formatDate } from '../lib/api.js';
import { useTxCreatedListener, notifyTxCreated } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { MandatoryAccountGate } from '../components/MandatoryAccountGate.jsx';

// Same three types, icons and active colors as the "New transaction" modal's
// type selector (components/NewTransactionModal.jsx) — kept in sync so the
// tab looks and behaves identically everywhere it appears in the app.
const TYPES = [
  { value: 'expense', label: 'Expense', icon: ArrowDownRight, activeClass: 'bg-rose-500 text-white shadow-glow' },
  { value: 'income', label: 'Income', icon: ArrowUpRight, activeClass: 'bg-emerald-500 text-white shadow-glow' },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, activeClass: 'bg-brand-500 text-white shadow-glow' },
];
const CATEGORY_LABELS = ['Rent', 'Utilities', 'Subscription', 'Insurance', 'Credit Card', 'Loan', 'Internet', 'Phone', 'Other'];
const FREQUENCIES = [
  { value: 'one-time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Bank Transfer', 'Auto Debit'];
// Same quick-tag set as the "New transaction" modal's Tags pills — kept in
// sync so a bill and the transactions it later posts can share tags.
const QUICK_TAGS = ['Savings', 'Investment', 'Protection', 'Expenditure', 'Income'];

function blankForm(accounts) {
  return {
    name: '', type: 'expense', amount: '', category: CATEGORY_LABELS[0], categoryId: '', dueDate: new Date().toISOString().slice(0, 10),
    frequency: 'monthly', vendor: '', paymentMethod: 'Bank Transfer', note: '', labels: [], autoPost: false, active: true, autopay: false,
    accountId: accounts[0]?.id || '', fromAccountId: accounts[0]?.id || '', toAccountId: accounts[1]?.id || '',
  };
}

function urgencyDays(dueDate) {
  return Math.round((new Date(dueDate) - new Date()) / 86400000);
}

// Names the two calendar months right before this one (e.g. run in
// September -> "July"/"August") so the "First Time Adding Bills?" example
// always reads as genuinely recent instead of a hardcoded "June or July".
function monthNameAgo(n) {
  const d = new Date();
  d.setDate(1); // avoid a day-31 rollover skipping a short month when setMonth is applied
  d.setMonth(d.getMonth() - n);
  return d.toLocaleString('en-US', { month: 'long' });
}

function BillModal({ open, onClose, editing, categories, accounts, onSaved }) {
  const [form, setForm] = useState(blankForm(accounts));
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [tipExpanded, setTipExpanded] = useState(false);
  const [labelInput, setLabelInput] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setFieldErrors({});
    setTipExpanded(false);
    setLabelInput('');
    if (editing) {
      setForm({
        name: editing.name, type: editing.type, amount: String(editing.amount), category: editing.category || CATEGORY_LABELS[0],
        categoryId: editing.categoryId || '', dueDate: editing.dueDate, frequency: editing.frequency,
        vendor: editing.vendor || '', paymentMethod: editing.paymentMethod || 'Bank Transfer', note: editing.note || '',
        labels: editing.labels || [],
        autoPost: !!editing.autoPost, active: editing.active !== false, autopay: !!editing.autopay,
        accountId: editing.accountId || accounts[0]?.id || '',
        fromAccountId: editing.fromAccountId || accounts[0]?.id || '',
        toAccountId: editing.toAccountId || accounts[1]?.id || '',
      });
    } else {
      setForm(blankForm(accounts));
    }
  }, [open, editing, accounts]);

  function addLabel(raw) {
    const clean = raw.trim();
    if (!clean || form.labels.includes(clean)) return;
    setForm((f) => ({ ...f, labels: [...f.labels, clean] }));
    setLabelInput('');
  }
  function removeLabel(label) {
    setForm((f) => ({ ...f, labels: f.labels.filter((l) => l !== label) }));
  }

  function validate() {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Bill name is required.';
    if (!(Number(form.amount) > 0)) errors.amount = 'Enter an amount greater than 0.';
    if (!form.dueDate || Number.isNaN(new Date(form.dueDate).getTime())) errors.dueDate = 'Enter a valid due date.';
    if (form.type === 'transfer') {
      if (!form.fromAccountId) errors.fromAccountId = 'Select an account.';
      if (!form.toAccountId) errors.toAccountId = 'Select an account.';
      if (form.fromAccountId && form.fromAccountId === form.toAccountId) errors.toAccountId = 'From and to accounts must be different.';
    } else {
      if (!form.categoryId) errors.categoryId = 'Select a category so we know how to book the transaction.';
      if (!form.accountId) errors.accountId = 'Select an account.';
    }
    if (form.labels.length === 0) errors.labels = 'Select at least one tag or add a label.';
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
      const payload = { ...form, amount: Number(form.amount), status: editing?.status || 'pending' };
      if (editing) await billsApi.update(editing.id, payload);
      else await billsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save this bill.');
    } finally {
      setSubmitting(false);
    }
  }

  const subtitle = form.autoPost
    ? 'Auto-post: the backend will post a transaction on each due date.'
    : 'Reminder: mark it paid yourself each cycle.';
  const exampleMonth = monthNameAgo(1);
  const earlierExampleMonth = monthNameAgo(2);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit bill' : 'Add bill'} subtitle={subtitle} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}

        <Alert tone="info" title="💡 First Time Adding Bills?">
          <div className={tipExpanded ? '' : 'line-clamp-4'}>
            <p>If you're entering bills from previous months (for example, {earlierExampleMonth} or {exampleMonth}), leave the options below turned OFF.</p>
            <p className="mt-2">
              After you've recorded the payment and marked the bill as &quot;Paid&quot;, edit the bill and enable the recurring
              options so future bills are handled automatically.
            </p>
            <p className="mt-2 font-semibold text-fg">Example:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li>Today you add your {exampleMonth} Rent bill.</li>
              <li>Save it without enabling the options below.</li>
              <li>Mark the {exampleMonth} bill as Paid.</li>
              <li>Then enable the recurring options so the bill is automatically managed from the next billing cycle onward.</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setTipExpanded((v) => !v)}
            className="mt-1.5 text-xs font-semibold text-brand-500 hover:text-brand-400"
          >
            {tipExpanded ? 'Show less' : 'Read more'}
          </button>
        </Alert>

        <div className="flex gap-2 rounded-xl border border-line bg-surface-2 p-1">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: t.value }))}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
                form.type === t.value ? t.activeClass : 'text-muted hover:text-fg'
              }`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>
        <Field label={<RequiredLabel>Bill name</RequiredLabel>} error={fieldErrors.name}>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={form.type === 'transfer' ? 'e.g. Monthly savings sweep' : 'e.g. Rent, Netflix, Electricity'} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={<RequiredLabel>Amount</RequiredLabel>} error={fieldErrors.amount}>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
          </Field>
          <Field label={<RequiredLabel>Due date</RequiredLabel>} error={fieldErrors.dueDate}>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </Field>
        </div>
        {form.type !== 'transfer' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category (label)">
              <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                {CATEGORY_LABELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label={<RequiredLabel>Category (for posting)</RequiredLabel>} error={fieldErrors.categoryId}>
              <IconSelect
                value={form.categoryId} options={categories} placeholder="Select category"
                onChange={(id) => setForm((f) => ({ ...f, categoryId: id }))}
                renderIcon={(c) => (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${c.color}22`, color: c.color }}>
                    <DynamicIcon name={c.icon} size={13} />
                  </span>
                )}
              />
            </Field>
          </div>
        )}
        {form.type === 'transfer' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label={<RequiredLabel>From account</RequiredLabel>} error={fieldErrors.fromAccountId}>
              <IconSelect
                value={form.fromAccountId} options={accounts} placeholder="Select account"
                onChange={(id) => setForm((f) => ({ ...f, fromAccountId: id }))}
                renderIcon={(a) => (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${a.color}22`, color: a.color }}>
                    <DynamicIcon name={a.icon} size={13} />
                  </span>
                )}
              />
            </Field>
            <Field label={<RequiredLabel>To account</RequiredLabel>} error={fieldErrors.toAccountId}>
              <IconSelect
                value={form.toAccountId} options={accounts.filter((a) => a.id !== form.fromAccountId)} placeholder="Select account"
                onChange={(id) => setForm((f) => ({ ...f, toAccountId: id }))}
                renderIcon={(a) => (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${a.color}22`, color: a.color }}>
                    <DynamicIcon name={a.icon} size={13} />
                  </span>
                )}
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Frequency">
              <Select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}>
                {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </Field>
            <Field label={<RequiredLabel>Paid from account</RequiredLabel>} error={fieldErrors.accountId}>
              <IconSelect
                value={form.accountId} options={accounts} placeholder="Select account"
                onChange={(id) => setForm((f) => ({ ...f, accountId: id }))}
                renderIcon={(a) => (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${a.color}22`, color: a.color }}>
                    <DynamicIcon name={a.icon} size={13} />
                  </span>
                )}
              />
            </Field>
          </div>
        )}
        {form.type === 'transfer' && (
          <Field label="Frequency">
            <Select value={form.frequency} onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </Select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor"><Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Netflix" /></Field>
          <Field label="Payment method">
            <Select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={<RequiredLabel>Tags</RequiredLabel>} error={fieldErrors.labels}>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => {
              const active = form.labels.includes(tag);
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
          <p className="mt-1 text-xs text-subtle">Savings/Investment also count toward the savings line on your Cash flow chart.</p>
        </Field>

        <Field label="Labels">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface-2 p-2">
            {form.labels.map((l) => (
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

        <Field label="Note"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional" /></Field>

        <div className="rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.autoPost} onChange={(e) => setForm((f) => ({ ...f, autoPost: e.target.checked }))} className="h-4 w-4 rounded border-line" />
            <span className="font-medium text-fg">Automatically create a transaction on every due date</span>
            <Tooltip
              side="bottom"
              label={
                <>
                  <p>When the bill reaches its due date, the app will automatically create a transaction in your account.</p>
                  <p className="mt-1.5 text-app/70">Example: Rent is due on the 1st of every month. On the 1st, the app automatically creates a Rent expense transaction.</p>
                </>
              }
            >
              <Info size={14} className="text-subtle" />
            </Tooltip>
          </label>
          {form.autoPost && (
            <label className="mt-2 flex items-center gap-2 pl-6 text-sm text-muted">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-line" />
              Active — turn this off to pause it temporarily without deleting the bill
            </label>
          )}
        </div>

        <div className="rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.autopay} onChange={(e) => setForm((f) => ({ ...f, autopay: e.target.checked }))} className="h-4 w-4 rounded border-line" />
            <span className="font-medium text-fg">This bill is paid automatically by my bank</span>
            <Tooltip
              side="bottom"
              label={
                <>
                  <p>Enable this if your bank or card automatically pays this bill every month. The app will only send reminders and track the bill — it will not expect you to manually pay it.</p>
                  <p className="mt-1.5 text-app/70">Example: Netflix is automatically charged to your credit card every month. Enable this option so the app knows the payment is handled automatically.</p>
                </>
              }
            >
              <Info size={14} className="text-subtle" />
            </Tooltip>
          </label>
        </div>

        {(form.autoPost || form.autopay) && (
          <Alert tone="success">
            You are enabling recurring automation for future billing cycles only. Previous bills will not be modified.
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Add bill'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function BillCard({ bill, accounts, onMarkPaid, onMarkPending, onRunNow, onToggleActive, onEdit, onDelete }) {
  const days = urgencyDays(bill.dueDate);
  const urgent = bill.status === 'pending' && days <= 5;
  const paused = bill.autoPost && bill.active === false;
  const isTransfer = bill.type === 'transfer';
  const freqLabel = bill.frequency === 'one-time' ? 'One-time' : bill.frequency[0].toUpperCase() + bill.frequency.slice(1);
  const subtitle = isTransfer
    ? `${accounts.find((a) => a.id === bill.fromAccountId)?.name || '—'} → ${accounts.find((a) => a.id === bill.toAccountId)?.name || '—'} · ${freqLabel}`
    : `${bill.category} · ${freqLabel}`;
  return (
    <Card hover className="group">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-display text-base font-semibold text-fg">{bill.name}</p>
          <p className="truncate text-xs text-subtle">{subtitle}</p>
        </div>
        <span className={`font-display text-lg font-bold ${bill.type === 'income' ? 'text-emerald-500' : isTransfer ? 'text-brand-500' : 'text-fg'}`}>{formatCurrency(bill.amount)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip tone={urgent ? 'danger' : 'neutral'}>
          <CalendarClock size={12} /> Due {formatDate(bill.dueDate)}{urgent ? (days < 0 ? ` · ${Math.abs(days)} day(s) ago` : ` · in ${days} day(s)`) : ''}
        </Chip>
        {bill.autoPost && <Chip tone="brand">🔄 Auto-post</Chip>}
        {bill.autopay && <Chip tone="warning">⚡ Autopay</Chip>}
        {paused && <Chip tone="neutral">Paused</Chip>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {bill.status === 'paid' ? (
          <button onClick={() => onMarkPending(bill)} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg">
            <Clock3 size={13} /> Mark as pending
          </button>
        ) : !bill.autoPost ? (
          <Button size="sm" variant="outline" fullWidth onClick={() => onMarkPaid(bill)} leftIcon={<CheckCircle2 size={14} />}>
            Mark as paid
          </Button>
        ) : null}
        <div className="ml-auto flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
          {bill.autoPost && bill.status === 'pending' && (
            <>
              <button onClick={() => onRunNow(bill)} title="Run now (post a transaction immediately, even if paused)" className="rounded-lg p-1.5 text-amber-500 hover:bg-amber-500/10"><Zap size={14} /></button>
              <button onClick={() => onToggleActive(bill)} title={paused ? 'Resume auto-post' : 'Pause auto-post'} className="rounded-lg p-1.5 text-muted hover:bg-tint/[0.06]">
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            </>
          )}
          <IconButton icon={Pencil} label="Edit bill" title="Edit bill" onClick={() => onEdit(bill)} />
          <IconButton icon={Trash2} variant="danger" label="Delete bill" title="Delete bill" onClick={() => onDelete(bill)} />
        </div>
      </div>
    </Card>
  );
}

export default function Bills() {
  const [bills, setBills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();

  async function load() {
    setLoadError('');
    try {
      const [b, c, a] = await Promise.all([billsApi.list(), categoriesApi.list(), accountsApi.list()]);
      setBills(b || []);
      setCategories(c || []);
      setAccounts(a || []);
    } catch (err) {
      setLoadError(err.message || 'Could not load your bills.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useTxCreatedListener(load);

  // Hooks must run unconditionally on every render — these useMemo calls
  // were previously placed after the loading/error/no-accounts early
  // returns below, so the first render (loading=true) skipped them
  // entirely and a later render called more hooks than before, which
  // crashes the whole app ("Rendered more hooks than during the previous
  // render"). Computing on an empty `bills` array is harmless.
  const pending = useMemo(
    () => bills.filter((b) => b.status === 'pending').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    [bills]
  );
  const paid = useMemo(() => bills.filter((b) => b.status === 'paid'), [bills]);
  const totalThisMonth = useMemo(() => bills.reduce((s, b) => s + b.amount, 0), [bills]);
  const totalPaid = useMemo(() => paid.reduce((s, b) => s + b.amount, 0), [paid]);
  const totalPending = useMemo(() => pending.reduce((s, b) => s + b.amount, 0), [pending]);

  if (loading || !accountsLoaded) return <p className="text-sm text-muted">Loading bills…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your bills"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }
  if (!hasAccounts) return <MandatoryAccountGate />;

  async function markPaid(bill) {
    const updated = await billsApi.update(bill.id, { status: 'paid' });
    if (updated?.postedTransaction) notifyTxCreated();
    load();
  }
  async function markPending(bill) {
    await billsApi.update(bill.id, { status: 'pending' });
    load();
  }
  async function runNow(bill) {
    await billsApi.run(bill.id);
    notifyTxCreated();
    load();
  }
  async function toggleActive(bill) {
    await billsApi.update(bill.id, { active: bill.active === false });
    load();
  }
  async function handleDelete(id) {
    await billsApi.remove(id);
    setConfirmDelete(null);
    load();
  }

  function editBill(bill) {
    setEditing(bill);
    setModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total this month" value={formatCurrency(totalThisMonth)} tone="brand" icon={<Wallet size={18} />} />
        <KpiCard label="Paid" value={formatCurrency(totalPaid)} tone="lime" icon={<CheckCircle2 size={18} />} />
        <KpiCard label="Pending" value={formatCurrency(totalPending)} tone="amber" icon={<Receipt size={18} />} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Recurring & Bills</h2>
          <p className="text-sm text-muted">Reminders you mark paid, plus subscriptions that post automatically.</p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Add bill</Button>
      </div>

      {bills.length === 0 ? (
        <EmptyState
          icon={<Receipt size={22} />} title="No bills tracked yet" body="Add your rent, utilities, or subscriptions and never miss a due date."
          action={<Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>Add your first bill</Button>}
        />
      ) : (
        <>
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted">
              <Clock3 size={14} className="text-amber-500" /> Pending ({pending.length})
            </p>
            {pending.length === 0 ? (
              <p className="text-sm text-subtle">Nothing pending — you're all caught up.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pending.map((b) => (
                  <BillCard
                    key={b.id} bill={b} accounts={accounts}
                    onMarkPaid={markPaid} onMarkPending={markPending} onRunNow={runNow} onToggleActive={toggleActive}
                    onEdit={editBill} onDelete={setConfirmDelete}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted">
              <CheckCircle2 size={14} className="text-emerald-500" /> Paid this month ({paid.length})
            </p>
            {paid.length === 0 ? (
              <p className="text-sm text-subtle">No paid this month yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {paid.map((b) => (
                  <BillCard
                    key={b.id} bill={b} accounts={accounts}
                    onMarkPaid={markPaid} onMarkPending={markPending} onRunNow={runNow} onToggleActive={toggleActive}
                    onEdit={editBill} onDelete={setConfirmDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <BillModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} categories={categories} accounts={accounts} onSaved={load} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete bill?"
        subtitle="This can't be undone."
        body={<>Are you sure you want to delete <span className="font-semibold text-fg">{confirmDelete?.name}</span>?</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
