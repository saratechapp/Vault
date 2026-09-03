import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Wallet, PiggyBank, TrendingDown, Gauge } from 'lucide-react';
import { Button, Card, CardHeader, KpiCard, ProgressBar, Chip, Modal, ConfirmDialog, IconButton, Field, Input, Select, EmptyState, DynamicIcon } from '../components/ui/index.js';
import { budgetsApi, categoriesApi, formatCurrency } from '../lib/api.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { MandatoryAccountGate } from '../components/MandatoryAccountGate.jsx';

const PERIODS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

function blankForm(categories) {
  return { categoryId: categories[0]?.id || '', limit: '', period: 'monthly', alertAt: '80', startDate: '', endDate: '' };
}

function toneFor(pct) {
  if (pct >= 100) return 'danger';
  if (pct >= 90) return 'danger';
  if (pct >= 75) return 'warning';
  return 'brand';
}

function BudgetModal({ open, onClose, editing, categories, onSaved }) {
  const [form, setForm] = useState(blankForm(categories));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        categoryId: editing.categoryId, limit: String(editing.limit), period: editing.period,
        alertAt: String(editing.alertAt ?? 80), startDate: editing.startDate || '', endDate: editing.endDate || '',
      });
    } else {
      setForm(blankForm(categories));
    }
  }, [open, editing, categories]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.categoryId) return setError('Select a category.');
    if (!(Number(form.limit) > 0)) return setError('Enter a limit greater than 0.');
    if (form.period === 'custom' && (!form.startDate || !form.endDate)) return setError('Set both start and end dates for a custom period.');
    setSubmitting(true);
    try {
      const payload = {
        categoryId: form.categoryId, limit: Number(form.limit), period: form.period, alertAt: Number(form.alertAt) || 80,
        startDate: form.period === 'custom' ? form.startDate : null,
        endDate: form.period === 'custom' ? form.endDate : null,
      };
      if (editing) await budgetsApi.update(editing.id, payload);
      else await budgetsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save budget.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit budget' : 'New budget'} subtitle="Pick a category, a limit and a period." size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <Field label="Category">
          <Select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Limit">
          <Input type="number" step="0.01" value={form.limit} onChange={(e) => setForm((f) => ({ ...f, limit: e.target.value }))} placeholder="0.00" />
        </Field>
        <Field label="Period">
          <div className="grid grid-cols-4 gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.value} type="button" onClick={() => setForm((f) => ({ ...f, period: p.value }))}
                className={`rounded-xl border py-2 text-xs font-medium transition ${form.period === p.value ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-line text-muted hover:bg-tint/[0.05]'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>
        {form.period === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></Field>
            <Field label="End date"><Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></Field>
          </div>
        )}
        <Field label="Alert at (%)" hint="You'll get a notification once spending crosses this percentage.">
          <Input type="number" min="1" max="100" value={form.alertAt} onChange={(e) => setForm((f) => ({ ...f, alertAt: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Add budget'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();

  async function load() {
    setLoadError('');
    try {
      const [b, c] = await Promise.all([budgetsApi.list(), categoriesApi.list()]);
      setBudgets(b || []);
      setCategories(c || []);
    } catch (err) {
      setLoadError(err.message || 'Could not load your budgets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useTxCreatedListener(load);

  // Hooks must run unconditionally on every render — these useMemo calls
  // were previously placed after the loading/error/no-accounts early
  // returns below, so the first render (loading=true) skipped them
  // entirely and a later render called two more hooks than before,
  // which crashes the whole app ("Rendered more hooks than during the
  // previous render"). Computing on an empty `budgets` array is harmless.
  const totalBudget = useMemo(() => budgets.reduce((s, b) => s + b.limit, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((s, b) => s + b.spent, 0), [budgets]);

  if (loading || !accountsLoaded) return <p className="text-sm text-muted">Loading budgets…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your budgets"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }
  if (!hasAccounts) return <MandatoryAccountGate />;

  const remaining = totalBudget - totalSpent;
  const overallPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  async function handleDelete(id) {
    await budgetsApi.remove(id);
    setConfirmDelete(null);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total budget" value={formatCurrency(totalBudget)} tone="brand" icon={<Wallet size={18} />} />
        <KpiCard label="Total spent" value={formatCurrency(totalSpent)} tone="rose" icon={<TrendingDown size={18} />} />
        <KpiCard label="Remaining" value={formatCurrency(remaining)} tone="lime" icon={<PiggyBank size={18} />} />
        <KpiCard label="Overall usage" value={`${overallPct.toFixed(0)}%`} tone="cyan" icon={<Gauge size={18} />} />
      </div>

      <Card>
        <CardHeader title="Overall progress" subtitle="All budgets combined" />
        <ProgressBar value={overallPct} size="lg" tone={toneFor(overallPct)} />
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-fg">Category budgets</h2>
        <Button leftIcon={<Plus size={15} />} onClick={() => { setEditing(null); setModalOpen(true); }}>New budget</Button>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={<PiggyBank size={22} />} title="No budgets yet" body="Set a limit on a category to start tracking spend against it."
          action={<Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>New budget</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((b) => {
            const pct = Math.min(100, (b.spent / b.limit) * 100);
            const over = b.spent > b.limit;
            return (
              <Card key={b.id} hover className="group">
                <div className="flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${b.category?.color || '#6366f1'}22`, color: b.category?.color || '#6366f1' }}>
                    <DynamicIcon name={b.category?.icon || 'Circle'} size={20} />
                  </span>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton icon={Pencil} label="Edit" onClick={() => { setEditing(b); setModalOpen(true); }} />
                    <IconButton icon={Trash2} variant="danger" label="Delete" onClick={() => setConfirmDelete(b)} />
                  </div>
                </div>
                <p className="mt-3 font-display text-base font-semibold text-fg">{b.category?.name || 'Uncategorized'}</p>
                <p className="text-xs capitalize text-subtle">{b.period}</p>
                <p className="mt-2 text-sm text-muted">{formatCurrency(b.spent)} <span className="text-subtle">of {formatCurrency(b.limit)}</span></p>
                <ProgressBar value={pct} tone={toneFor(pct)} className="mt-2" />
                <div className="mt-2">
                  <Chip tone={over ? 'danger' : 'neutral'}>{over ? `${formatCurrency(b.spent - b.limit)} over` : `${formatCurrency(b.limit - b.spent)} left`}</Chip>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BudgetModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} categories={categories} onSaved={load} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete budget?"
        subtitle="This can't be undone. The transactions in this category are not affected."
        body="Are you sure you want to delete this budget?"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
