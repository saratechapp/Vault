import { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Plus, X } from 'lucide-react';
import { Modal, Button, Field, Input, Select, Chip, DynamicIcon, RequiredLabel, IconSelect } from './ui/index.js';
import { transactionsApi, templatesApi } from '../lib/api.js';
import { CURRENCIES, readPrefs } from '../lib/preferences.js';

const TYPES = [
  { value: 'expense', label: 'Expense', icon: ArrowDownRight, activeClass: 'bg-rose-500 text-white shadow-glow' },
  { value: 'income', label: 'Income', icon: ArrowUpRight, activeClass: 'bg-emerald-500 text-white shadow-glow' },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight, activeClass: 'bg-brand-500 text-white shadow-glow' },
];
const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 'Cash', 'Cheque', 'Other'];
const PAYMENT_STATUSES = ['cleared', 'pending', 'reconciled'];
const QUICK_TAGS = ['Savings', 'Investment', 'Protection', 'Expenditure', 'Income'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function nowLocalDatetime() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function blankForm(currency) {
  return {
    datetime: nowLocalDatetime(), vendor: '', categoryId: '', amount: '', currency,
    accountId: '', fromAccountId: '', toAccountId: '', note: '', payer: '',
    paymentMethod: 'Bank Transfer', paymentStatus: 'cleared', labels: [],
  };
}

export default function NewTransactionModal({ open, onClose, editingTxn, prefillTxn, categories, accounts, templates, transactions, onSaved }) {
  const [type, setType] = useState('expense');
  const [form, setForm] = useState(blankForm());
  const [labelInput, setLabelInput] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const isEdit = !!editingTxn;
  const prefs = readPrefs();

  useEffect(() => {
    if (!open) return;
    setSubmitError('');
    setFieldErrors({});
    setTemplateId('');
    setSaveAsTemplate(false);
    if (editingTxn) {
      setType(editingTxn.type);
      setForm({
        datetime: `${editingTxn.date?.slice(0, 10) || todayIso()}T12:00`,
        vendor: editingTxn.vendor || '',
        categoryId: editingTxn.categoryId || '',
        amount: String(Math.abs(editingTxn.amount || 0)),
        currency: editingTxn.currency || prefs.currency,
        accountId: editingTxn.accountId || '',
        fromAccountId: editingTxn.fromAccountId || '',
        toAccountId: editingTxn.toAccountId || '',
        note: editingTxn.note || '',
        payer: editingTxn.payer || '',
        paymentMethod: editingTxn.paymentMethod || 'Bank Transfer',
        paymentStatus: editingTxn.paymentStatus || 'cleared',
        labels: editingTxn.labels || [],
      });
    } else if (prefillTxn) {
      setType(prefillTxn.type || 'transfer');
      setForm({ ...blankForm(prefs.currency), ...prefillTxn, amount: String(Math.abs(prefillTxn.amount ?? '')) });
    } else {
      setType('expense');
      setForm(blankForm(prefs.currency));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingTxn, prefillTxn]);

  const categoryOptions = useMemo(() => {
    // Categories are Postgres uuids now, not fixed strings like the old
    // 'cat_transfer' — the system Transfer category (seeded per-user by
    // 0001_init.sql) has to be excluded by name instead.
    const list = categories.filter((c) => c.name !== 'Transfer');
    const parents = list.filter((c) => !c.parentId);
    const ordered = [];
    parents.forEach((p) => {
      ordered.push(p);
      list.filter((c) => c.parentId === p.id).forEach((child) => ordered.push(child));
    });
    list.forEach((c) => {
      if (c.parentId && !ordered.includes(c)) ordered.push(c);
    });
    return ordered;
  }, [categories]);
  const vendorLabel = type === 'transfer' ? 'Description' : 'Vendor / Source';

  const suggestedLabels = useMemo(() => {
    if (!transactions?.length) return [];
    let pool;
    if (type === 'transfer') {
      pool = transactions.filter((t) => t.type === 'transfer');
    } else {
      const sameCategory = transactions.filter((t) => t.categoryId === form.categoryId && t.type !== 'transfer');
      const sameType = transactions.filter((t) => t.type === type);
      pool = sameCategory.length ? sameCategory : sameType.length ? sameType : transactions;
    }
    const counts = new Map();
    pool.forEach((t) => (t.labels || []).forEach((l) => l && counts.set(l, (counts.get(l) || 0) + 1)));
    const categoryNames = new Set(categories.map((c) => c.name));
    const accountNames = new Set(accounts.map((a) => a.name));
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label]) => label)
      .filter((l) => !form.labels.includes(l) && !categoryNames.has(l) && !accountNames.has(l))
      .slice(0, 8);
  }, [transactions, type, form.categoryId, form.labels, categories, accounts]);

  // Automatic categorization: learn from past transactions with the same
  // vendor and prefill the category the user picked most often for it. Only
  // ever fills an empty field — a manual choice (this session or an edit)
  // always wins, so this can only save a click, never override the user.
  const categorySuggestion = useMemo(() => {
    if (isEdit || type === 'transfer' || !form.vendor.trim() || !transactions?.length) return null;
    const needle = form.vendor.trim().toLowerCase();
    const matches = transactions.filter((t) => t.type !== 'transfer' && t.categoryId && (t.vendor || '').trim().toLowerCase() === needle);
    if (!matches.length) return null;
    const counts = new Map();
    matches.forEach((t) => counts.set(t.categoryId, (counts.get(t.categoryId) || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }, [transactions, form.vendor, type, isEdit]);

  useEffect(() => {
    if (!categorySuggestion) return;
    setForm((f) => (f.categoryId ? f : { ...f, categoryId: categorySuggestion }));
  }, [categorySuggestion]);
  const categoryWasSuggested = !isEdit && !!categorySuggestion && form.categoryId === categorySuggestion;

  function applyTemplate(id) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setType(tpl.type);
    setForm((f) => ({
      ...f,
      vendor: tpl.vendor || '',
      categoryId: tpl.categoryId || '',
      amount: tpl.amount ? String(Math.abs(tpl.amount)) : '',
      accountId: tpl.accountId || '',
      paymentMethod: tpl.paymentMethod || f.paymentMethod,
      note: tpl.note || '',
    }));
  }

  function addLabel(label) {
    const clean = label.trim();
    if (!clean || form.labels.includes(clean)) return;
    setForm((f) => ({ ...f, labels: [...f.labels, clean] }));
    setLabelInput('');
  }
  function removeLabel(label) {
    setForm((f) => ({ ...f, labels: f.labels.filter((l) => l !== label) }));
  }

  function validate() {
    const errors = {};
    if (!form.amount || Number(form.amount) <= 0) errors.amount = 'Enter a valid amount.';
    if (type !== 'transfer' && !form.vendor) errors.vendor = `${vendorLabel} is required.`;
    if (type !== 'transfer' && !form.accountId) errors.accountId = 'Select an account.';
    if (type !== 'transfer' && !form.categoryId) errors.categoryId = 'Select a category.';
    if (type === 'transfer' && !form.fromAccountId) errors.fromAccountId = 'Select an account.';
    if (type === 'transfer' && !form.toAccountId) errors.toAccountId = 'Select an account.';
    if (type === 'transfer' && form.fromAccountId && form.fromAccountId === form.toAccountId) {
      errors.toAccountId = 'From and To accounts must be different.';
    }
    if (!isEdit && !QUICK_TAGS.some((tag) => form.labels.includes(tag))) errors.labels = 'Select at least one tag.';
    return errors;
  }

  async function handleSubmit(e, { keepOpen = false } = {}) {
    e.preventDefault();
    setSubmitError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = {
        type,
        date: form.datetime.slice(0, 10),
        amount: Number(form.amount),
        currency: form.currency,
        vendor: type === 'transfer' ? form.vendor || 'Transfer' : form.vendor,
        // The backend resolves a transfer's categoryId itself (the real
        // 'Transfer' category, a Postgres uuid seeded per-user) — it used to
        // be hardcoded here as the literal string 'cat_transfer', a leftover
        // from the pre-Postgres backend's fixed string category ids, which
        // crashed every transfer since that string isn't a valid uuid.
        categoryId: type === 'transfer' ? null : form.categoryId,
        note: form.note,
        labels: form.labels,
        paymentMethod: form.paymentMethod,
        payer: form.payer,
        paymentStatus: form.paymentStatus,
        ...(type === 'transfer' ? { fromAccountId: form.fromAccountId, toAccountId: form.toAccountId } : { accountId: form.accountId }),
      };

      if (isEdit) {
        await transactionsApi.update(editingTxn.id, payload);
      } else {
        await transactionsApi.create(payload);
        if (saveAsTemplate) {
          await templatesApi.create({
            name: form.vendor || 'New template', type, amount: Number(form.amount),
            categoryId: payload.categoryId, accountId: form.accountId,
            paymentMethod: form.paymentMethod, vendor: form.vendor, note: form.note,
          });
        }
      }
      onSaved?.();
      if (keepOpen) {
        setForm(blankForm(form.currency));
        setTemplateId('');
      } else {
        onClose();
      }
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit transaction' : 'Add record'} size="lg">
      <form onSubmit={(e) => handleSubmit(e, { keepOpen: false })}>
        {!isEdit && (
          <div className="mb-4 flex items-end gap-2">
            <Field label="Select template" className="flex-1">
              <Select value={templateId} onChange={(e) => applyTemplate(e.target.value)}>
                <option value="">None — start blank</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <button
              type="button"
              title="Create template from this record"
              aria-pressed={saveAsTemplate}
              onClick={() => setSaveAsTemplate((s) => !s)}
              className={`flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition ${
                saveAsTemplate ? 'border-transparent bg-emerald-500 text-white' : 'border-line bg-tint/[0.04] text-muted hover:text-fg'
              }`}
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {!isEdit && (
          <div className="mb-5 flex gap-2 rounded-xl border border-line bg-surface-2 p-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  type === t.value ? t.activeClass : 'text-muted hover:text-fg'
                }`}
              >
                <t.icon size={15} /> {t.label}
              </button>
            ))}
          </div>
        )}

        {submitError && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{submitError}</p>}

        <div className="grid grid-cols-2 gap-x-6">
          {/* Left column */}
          <div className="space-y-4">
            {type === 'transfer' ? (
              <Field label={vendorLabel} error={fieldErrors.vendor}>
                <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="Optional description" />
              </Field>
            ) : (
              <Field label={<RequiredLabel>{vendorLabel}</RequiredLabel>} error={fieldErrors.vendor}>
                <Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Blue Tokai Coffee" />
              </Field>
            )}

            <div className="grid grid-cols-[2fr_1fr] gap-3">
              <Field label={<RequiredLabel>Amount</RequiredLabel>} error={fieldErrors.amount}>
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </Field>
              <Field label="Currency">
                <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
                </Select>
              </Field>
            </div>

            {type === 'transfer' ? (
              <>
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
              </>
            ) : (
              <>
                <Field label={<RequiredLabel>Account</RequiredLabel>} error={fieldErrors.accountId}>
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
                <Field
                  label={
                    <span className="inline-flex items-center gap-1.5">
                      <RequiredLabel>Category</RequiredLabel>
                      {categoryWasSuggested && <Chip tone="brand">Suggested</Chip>}
                    </span>
                  }
                  error={fieldErrors.categoryId}
                >
                  <IconSelect
                    value={form.categoryId} options={categoryOptions} placeholder="Select category"
                    onChange={(id) => setForm((f) => ({ ...f, categoryId: id }))}
                    renderIcon={(c) => (
                      <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: `${c.color}22`, color: c.color }}>
                        <DynamicIcon name={c.icon} size={13} />
                      </span>
                    )}
                  />
                </Field>
              </>
            )}

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
              {suggestedLabels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestedLabels.map((l) => (
                    <button key={l} type="button" onClick={() => addLabel(l)} className="chip text-xs text-muted hover:text-fg">
                      <Plus size={11} /> {l}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-subtle">Suggested labels — from your {type}s</p>
            </Field>

            <Field label="Date & time">
              <Input type="datetime-local" value={form.datetime} onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))} />
            </Field>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <p className="font-display text-sm font-semibold text-fg">Other details</p>
            <Field label="Note">
              <textarea
                value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Describe your record" rows={4} className="input resize-none"
              />
            </Field>
            <Field label="Payer">
              <Input value={form.payer} onChange={(e) => setForm((f) => ({ ...f, payer: e.target.value }))} placeholder="Who paid?" />
            </Field>
            <Field label="Payment type">
              <Select value={form.paymentMethod} onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Payment status">
              <Select value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {isEdit ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={submitting}>Save changes</Button>
            </>
          ) : (
            <>
              <Button type="submit" disabled={submitting}>Add record</Button>
              <Button type="button" variant="outline" disabled={submitting} onClick={(e) => handleSubmit(e, { keepOpen: true })}>
                Add and create another
              </Button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}
