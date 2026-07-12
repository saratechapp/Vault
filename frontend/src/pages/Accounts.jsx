import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, Eye, Landmark,
} from 'lucide-react';
import { Button, Card, Modal, ConfirmDialog, IconButton, Field, Input, Select, EmptyState, DynamicIcon, IconPicker, Alert } from '../components/ui/index.js';
import { accountsApi, formatCurrency } from '../lib/api.js';
import { CATEGORY_COLORS } from '../lib/categoryIcons.js';
import { CURRENCIES, readPrefs } from '../lib/preferences.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';
import { notifyAccountsChanged } from '../context/AccountsGateContext.jsx';
import { peekCreateAccountPrompt, clearCreateAccountPrompt } from '../lib/onboarding.js';

const TYPES = [
  { value: 'bank', label: 'Bank', icon: 'Landmark' },
  { value: 'savings', label: 'Savings', icon: 'PiggyBank' },
  { value: 'credit', label: 'Credit', icon: 'CreditCard' },
  { value: 'cash', label: 'Cash', icon: 'Wallet' },
  { value: 'wallet', label: 'Wallet', icon: 'Smartphone' },
];

function blankForm(currency) {
  return { name: '', type: 'bank', openingBalance: '', color: CATEGORY_COLORS[0], icon: 'Landmark', institution: '', currency };
}

function AccountModal({ open, onClose, editing, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const prefs = readPrefs();

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        name: editing.name, type: editing.type, openingBalance: String(editing.openingBalance),
        color: editing.color, icon: editing.icon, institution: editing.institution || '', currency: editing.currency || prefs.currency,
      });
    } else {
      setForm(blankForm(prefs.currency));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Account name is required.');
    setSubmitting(true);
    try {
      const payload = { ...form, openingBalance: Number(form.openingBalance) || 0 };
      if (editing) await accountsApi.update(editing.id, payload);
      else await accountsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit account' : 'Add account'} subtitle={editing ? 'Update your account details.' : 'Track a new bank, card, wallet, or cash pile.'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <Field label="Account name">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. HDFC Checking" />
        </Field>
        <Field label="Type">
          <div className="grid grid-cols-5 gap-2">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t.value, icon: t.icon }))}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs transition ${
                  form.type === t.value ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-line text-muted hover:bg-tint/[0.05]'
                }`}
              >
                <DynamicIcon name={t.icon} size={18} />
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Institution">
          <Input value={form.institution} onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))} placeholder="e.g. HDFC Bank" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opening balance" hint="Use a negative number for credit card balances.">
            <Input type="number" step="0.01" value={form.openingBalance} onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))} placeholder="0.00" />
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-7 w-7 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c, ...(form.color === c ? { '--tw-ring-color': c } : {}) }}
              />
            ))}
          </div>
        </Field>
        <Field label="Icon">
          <IconPicker value={form.icon} onChange={(name) => setForm((f) => ({ ...f, icon: name }))} color={form.color} />
        </Field>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{editing ? 'Save changes' : 'Add account'}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showCreatePrompt] = useState(() => peekCreateAccountPrompt());

  async function load() {
    setLoadError('');
    try {
      const list = await accountsApi.list();
      setAccounts(list || []);
    } catch (err) {
      setLoadError(err.message || 'Could not load your accounts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useTxCreatedListener(load);
  useEffect(() => {
    clearCreateAccountPrompt();
  }, []);

  async function handleDelete(id) {
    try {
      await accountsApi.remove(id);
      setConfirmDelete(null);
      load();
      notifyAccountsChanged();
    } catch (err) {
      alert(err.message || 'Could not delete this account.');
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading accounts…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your accounts"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {showCreatePrompt && accounts.length === 0 && (
        <Alert tone="info" title="Let's set up your first account">
          Add a bank account, cash, wallet, or credit card to start tracking your money.
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Your accounts</h2>
          <p className="text-sm text-muted">All the places your money lives.</p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Add account</Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark size={22} />}
          title="No accounts yet"
          body="Add your first account to start tracking balances and transfers."
          action={<Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>Add account</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} hover className="group relative overflow-hidden">
              <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ background: a.color, opacity: 0.2 }} />
              <div className="relative flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${a.color}22`, color: a.color }}>
                  <DynamicIcon name={a.icon} size={20} />
                </span>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <Link to={`/app/accounts/${a.id}`} title="View details" className="rounded-lg p-1.5 text-muted hover:bg-tint/[0.06] hover:text-fg">
                    <Eye size={14} />
                  </Link>
                  <IconButton icon={Pencil} label="Edit" title="Edit" onClick={() => { setEditing(a); setModalOpen(true); }} />
                  <IconButton icon={Trash2} variant="danger" label="Delete" title="Delete" onClick={() => setConfirmDelete(a)} />
                </div>
              </div>
              <Link to={`/app/accounts/${a.id}`} className="relative mt-3 block font-display text-base font-semibold text-fg transition hover:text-brand-500">
                {a.name}
              </Link>
              <p className="relative text-xs text-subtle">{a.institution || a.type}</p>
              <p className={`relative mt-3 font-display text-2xl font-bold ${a.balance < 0 ? 'text-rose-500' : 'text-fg'}`}>{formatCurrency(a.balance)}</p>
              {a.lastTransactionDate && (
                <p className="relative mt-1 text-xs text-subtle">
                  {formatCurrency(a.previousBalance)} {a.lastTransactionAmount >= 0 ? '+' : '−'} {formatCurrency(Math.abs(a.lastTransactionAmount))}
                </p>
              )}
              <div className="relative mt-3 flex gap-4 text-xs text-muted">
                <span>In {formatCurrency(a.inflow)}</span>
                <span>Out {formatCurrency(a.outflow)}</span>
                <span>{a.txnCount} txns</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AccountModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={() => { load(); notifyAccountsChanged(); }} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete account?"
        body={<>Are you sure you want to delete <span className="font-semibold text-fg">{confirmDelete?.name}</span>? This can't be undone.</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
