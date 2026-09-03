import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, SlidersHorizontal, Tags, FileStack, Bell, ShieldCheck, DatabaseBackup, LifeBuoy,
  LogOut, Plus, Pencil, Trash2, RefreshCw, Lock, Unlock, ChevronRight, Monitor, Upload,
} from 'lucide-react';
import {
  Avatar, Button, Card, CardHeader, Field, Input, Select, Textarea, Toggle, ToggleRow, Modal, IconPicker, IconButton, DynamicIcon, EmptyState,
} from '../components/ui/index.js';
import { FeedbackFormModal } from '../components/feedback/FeedbackFormModal.jsx';
import { CATEGORY_COLORS } from '../lib/categoryIcons.js';
import { CURRENCIES, COUNTRIES, LANGUAGES, DATE_FORMATS, getCurrencyMeta } from '../lib/preferences.js';
import {
  api, categoriesApi, templatesApi, accountsApi, formatCurrency,
  sessionsApi, twoFactorApi, dataApi,
} from '../lib/api.js';
import { supabase } from '../lib/supabaseClient.js';
import { getWebSessionId } from '../lib/deviceSession.js';
import { fetchRates } from '../lib/fx.js';
import { hasPin, setPin as savePin, removePin, lockNow } from '../lib/pin.js';
import { isPasswordValid, passwordValidationError } from '../lib/passwordValidation.js';
import { useAuth } from '../context/AuthContext.jsx';
import { usePreferences } from '../context/PreferencesContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const SECTIONS = [
  { value: 'profile', label: 'Profile', icon: User },
  { value: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { value: 'categories', label: 'Categories', icon: Tags },
  { value: 'templates', label: 'Templates', icon: FileStack },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'security', label: 'Security', icon: ShieldCheck },
  { value: 'data', label: 'Data & backups', icon: DatabaseBackup },
  { value: 'help', label: 'Help & support', icon: LifeBuoy },
];

// ---------------------------------------------------------------------------
function ProfilePanel() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return setError('Name is required.');
    setSaving(true);
    try {
      // Email lives in Supabase Auth (not the profile table) and changing it
      // needs a separate re-verification flow — only name/phone save here.
      const updated = await api.patch('/me', { name: form.name.trim(), phone: form.phone.trim() });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Choose an image file.');
    if (file.size > 3 * 1024 * 1024) return setError('Image must be under 3 MB.');
    setError('');
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const updated = await api.patch('/me', { avatar: data.publicUrl });
      setUser(updated);
    } catch (err) {
      setError(err.message || 'Could not upload that photo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader title="Profile" subtitle="Your personal information." />
      {error && <p className="mb-4 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      <div className="mb-6 flex items-center gap-4">
        <Avatar src={user?.avatar} name={user?.name} className="h-16 w-16 rounded-2xl border border-line text-lg" />
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handlePhoto} />
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading…' : 'Upload photo'}
        </Button>
      </div>
      <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Email">
          <Input type="email" value={user?.email || ''} readOnly disabled className="opacity-70" />
        </Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
        <div className="sm:col-span-2 flex items-center gap-3">
          <Button type="submit" disabled={saving}>Save changes</Button>
          {saved && <span className="text-sm text-emerald-500">Saved</span>}
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------------------
function AddCurrencyModal({ open, onClose, baseCurrency, existing, onAdd }) {
  const [code, setCode] = useState('');
  const [rate, setRate] = useState(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const options = CURRENCIES.filter((c) => c.code !== baseCurrency && !existing.includes(c.code));

  useEffect(() => {
    if (!open) { setCode(''); setRate(null); }
  }, [open]);

  async function loadRate(force = false) {
    if (!code) return;
    setLoadingRate(true);
    try {
      const rates = await fetchRates(baseCurrency, { force });
      setRate(rates[code.toLowerCase()] ?? null);
    } catch {
      setRate(null);
    } finally {
      setLoadingRate(false);
    }
  }

  useEffect(() => {
    if (code) loadRate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Modal open={open} onClose={onClose} title="Add currency" size="sm">
      <Field label="Currency">
        <Select value={code} onChange={(e) => setCode(e.target.value)}>
          <option value="">Select a currency</option>
          {options.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
        </Select>
      </Field>
      {code && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2 p-3 text-sm">
          {loadingRate ? (
            <p className="text-muted">Fetching live rate…</p>
          ) : rate ? (
            <>
              <p className="text-muted">1 {baseCurrency} = <span className="font-semibold text-fg">{rate.toFixed(4)} {code}</span></p>
              <p className="mt-1 text-muted">1 {code} = <span className="font-semibold text-fg">{(1 / rate).toFixed(4)} {baseCurrency}</span></p>
            </>
          ) : (
            <p className="text-rose-500">Could not fetch a live rate.</p>
          )}
          <button type="button" onClick={() => loadRate(true)} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-400">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      )}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!code || !rate} onClick={() => { onAdd({ code, rate, updatedAt: new Date().toISOString() }); onClose(); }}>Add</Button>
      </div>
    </Modal>
  );
}

function PreferencesPanel() {
  const { prefs, setPrefs } = usePreferences();
  const { theme, setTheme } = useTheme();
  const [form, setForm] = useState(prefs);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function handleCountryChange(code) {
    const country = COUNTRIES.find((c) => c.code === code);
    setForm((f) => ({ ...f, country: code, currency: country?.currency || f.currency, timezone: country?.timezone || f.timezone }));
  }

  function handleSave() {
    setSaving(true);
    // setPrefs also pushes country/currency/currencySymbol to the backend
    // profile (see PreferencesContext.jsx) — the admin panel's User grid
    // and dashboard charts read from there, not from this browser's
    // localStorage, so without that sync every user would show up as the
    // schema default (India/INR) regardless of their real preference.
    setPrefs(form);
    setTimeout(() => window.location.reload(), 600);
  }

  const currencies = form.currencies || [];

  return (
    <div className="space-y-5">
      <Card padding="lg">
        <CardHeader title="Location & currency" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country">
            <Select value={form.country} onChange={(e) => handleCountryChange(e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </Select>
          </Field>
          <Field label="Language">
            <Select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </Select>
          </Field>
          <Field label="Timezone">
            <Input value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
          </Field>
        </div>
        <div className="mt-4">
          <p className="label">Date format</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DATE_FORMATS.map((d) => (
              <button
                key={d.value} type="button" onClick={() => setForm((f) => ({ ...f, dateFormat: d.value }))}
                className={`rounded-xl border p-3 text-left transition ${form.dateFormat === d.value ? 'border-brand-500 bg-brand-500/10' : 'border-line hover:bg-tint/[0.05]'}`}
              >
                <p className="text-xs font-semibold text-fg">{d.label}</p>
                <p className="text-xs text-subtle">{d.sample}</p>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Theme" />
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                if (t.value === 'system') {
                  setTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                } else {
                  setTheme(t.value);
                }
              }}
              className={`rounded-xl border py-2 text-sm font-medium transition ${theme === t.value ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-line text-muted hover:bg-tint/[0.05]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Your currencies" subtitle="Track live FX rates against your primary currency." right={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setCurrencyModalOpen(true)}>Add currency</Button>} />
        {currencies.length === 0 ? (
          <p className="text-sm text-subtle">No additional currencies tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {currencies.map((c) => {
              const meta = getCurrencyMeta(c.code);
              return (
                <div key={c.code} className="flex items-center justify-between rounded-xl border border-line p-3">
                  <div>
                    <p className="text-sm font-semibold text-fg">{c.code} — {meta.name}</p>
                    <p className="text-xs text-subtle">1 {form.currency} = {c.rate?.toFixed(4)} {c.code}</p>
                  </div>
                  <IconButton
                    icon={Trash2}
                    variant="danger"
                    label="Remove currency"
                    onClick={() => setForm((f) => ({ ...f, currencies: f.currencies.filter((x) => x.code !== c.code) }))}
                  />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="Display" />
        <ToggleRow title="Compact tables" body="Show denser rows in tables." checked={form.compactTables} onChange={(v) => setForm((f) => ({ ...f, compactTables: v }))} />
        <div className="divider" />
        <ToggleRow title="Weekly digest email" body="A summary of your spending every Monday." checked={form.weeklyDigest} onChange={(v) => setForm((f) => ({ ...f, weeklyDigest: v }))} />
        <div className="divider" />
        <ToggleRow
          title="Account budget breakdown"
          body="Show category & subcategory budget progress on each account's detail page. Applies immediately."
          checked={prefs.showAccountBudgetBreakdown}
          onChange={(v) => setPrefs({ showAccountBudgetBreakdown: v })}
        />
      </Card>

      <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>

      <AddCurrencyModal
        open={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)} baseCurrency={form.currency}
        existing={currencies.map((c) => c.code)}
        onAdd={(entry) => setForm((f) => ({ ...f, currencies: [...(f.currencies || []), entry] }))}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
function CategoryModal({ open, onClose, editing, parentId, categories, onSaved }) {
  const [form, setForm] = useState({ name: '', icon: 'Circle', color: CATEGORY_COLORS[0], parentId: parentId || '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) setForm({ name: editing.name, icon: editing.icon, color: editing.color, parentId: editing.parentId || '' });
    else setForm({ name: '', icon: 'Circle', color: CATEGORY_COLORS[0], parentId: parentId || '' });
  }, [open, editing, parentId]);

  const parentOptions = categories.filter((c) => !c.parentId && c.id !== editing?.id);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Category name is required.');
    try {
      const payload = { name: form.name, icon: form.icon, color: form.color, parentId: form.parentId || null };
      if (editing) await categoriesApi.update(editing.id, payload);
      else await categoriesApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save category.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit category' : 'New category'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Parent category">
          <Select value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
            <option value="">None — top-level category</option>
            {parentOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Icon"><IconPicker value={form.icon} onChange={(name) => setForm((f) => ({ ...f, icon: name }))} color={form.color} /></Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-7 w-7 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c, ...(form.color === c ? { '--tw-ring-color': c } : {}) }} />
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{editing ? 'Save changes' : 'Add category'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Shows the always-up-to-date running balance for a category or sub-category
// (Previous Balance + latest transaction = Current Balance), computed
// server-side from every transaction tagged with it.
function CategoryBalance({ category }) {
  if (!category.lastTransactionDate) return null;
  const last = category.lastTransactionAmount;
  return (
    <div className="text-right leading-tight" title={`Previous balance ${formatCurrency(category.previousBalance)}, then ${last >= 0 ? '+' : ''}${formatCurrency(last)}`}>
      <p className="text-sm font-semibold tabular-nums text-fg">{formatCurrency(category.balance)}</p>
      <p className="text-[11px] tabular-nums text-subtle">
        {formatCurrency(category.previousBalance)} {last >= 0 ? '+' : '−'} {formatCurrency(Math.abs(last))}
      </p>
    </div>
  );
}

function CategoriesPanel() {
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [parentForNew, setParentForNew] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setCategories((await categoriesApi.list()) || []);
    } catch (err) {
      setError(err.message || 'Could not load your categories.');
    }
  }
  useEffect(() => { load(); }, []);

  const parents = categories.filter((c) => !c.parentId);

  async function handleDelete(cat) {
    try {
      await categoriesApi.remove(cat.id);
      load();
    } catch (err) {
      setError(err.status === 409 ? `"${cat.name}" is used by existing transactions or budgets and can't be deleted.` : err.message);
    }
  }

  return (
    <Card padding="lg">
      <CardHeader title="Categories" subtitle="Organize transactions with categories and sub-categories." right={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => { setEditing(null); setParentForNew(null); setModalOpen(true); }}>Add category</Button>} />
      {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      <div className="space-y-4">
        {parents.map((parent) => {
          const children = categories.filter((c) => c.parentId === parent.id);
          return (
            <div key={parent.id} className="rounded-xl border border-line p-3">
              <div className="group flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${parent.color}22`, color: parent.color }}>
                    <DynamicIcon name={parent.icon} size={15} />
                  </span>
                  <span className="text-sm font-semibold text-fg">{parent.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CategoryBalance category={parent} />
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton icon={Plus} size={13} label="Add sub-category" title="Add sub-category" onClick={() => { setEditing(null); setParentForNew(parent.id); setModalOpen(true); }} />
                    <IconButton icon={Pencil} size={13} label="Edit" onClick={() => { setEditing(parent); setParentForNew(null); setModalOpen(true); }} />
                    <IconButton icon={Trash2} size={13} variant="danger" label="Delete" onClick={() => handleDelete(parent)} />
                  </div>
                </div>
              </div>
              {children.length > 0 && (
                <div className="ml-4 mt-2 space-y-1 border-l border-line pl-4">
                  {children.map((c) => (
                    <div key={c.id} className="group flex items-center justify-between rounded-lg py-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${c.color}22`, color: c.color }}>
                          <DynamicIcon name={c.icon} size={13} />
                        </span>
                        <span className="text-sm text-fg">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CategoryBalance category={c} />
                        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          <IconButton icon={Pencil} size={13} label="Edit" onClick={() => { setEditing(c); setModalOpen(true); }} />
                          <IconButton icon={Trash2} size={13} variant="danger" label="Delete" onClick={() => handleDelete(c)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <CategoryModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} parentId={parentForNew} categories={categories} onSaved={load} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
function blankTemplateForm() {
  return { name: '', type: 'expense', amount: '', categoryId: '', accountId: '', paymentMethod: '', vendor: '', note: '' };
}

function TemplateModal({ open, onClose, editing, categories, accounts, onSaved }) {
  const [form, setForm] = useState(blankTemplateForm());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        name: editing.name, type: editing.type, amount: String(editing.amount || ''), categoryId: editing.categoryId || '',
        accountId: editing.accountId || '', paymentMethod: editing.paymentMethod || '', vendor: editing.vendor || '', note: editing.note || '',
      });
    } else {
      setForm(blankTemplateForm());
    }
  }, [open, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Template name is required.');
    try {
      const payload = { ...form, amount: Number(form.amount) || 0 };
      if (editing) await templatesApi.update(editing.id, payload);
      else await templatesApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save template.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit template' : 'New template'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <Field label="Template name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
          </Field>
          <Field label="Amount"><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Account">
            <Select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}>
              <option value="">None</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Vendor"><Input value={form.vendor} onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))} /></Field>
        <Field label="Note"><Input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{editing ? 'Save changes' : 'Add template'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TemplatesPanel() {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const [t, c, a] = await Promise.all([templatesApi.list(), categoriesApi.list(), accountsApi.list()]);
      setTemplates(t || []);
      setCategories(c || []);
      setAccounts(a || []);
    } catch (err) {
      // Without this, a failed fetch left `templates` at its initial [] and
      // the "No templates yet" empty state rendered — indistinguishable from
      // genuinely having none.
      setError(err.message || 'Could not load your templates.');
    }
  }
  useEffect(() => { load(); }, []);

  async function handleDelete(id) {
    await templatesApi.remove(id);
    load();
  }

  return (
    <Card padding="lg">
      <CardHeader title="Templates" subtitle="Reusable presets for the Add Record form." right={<Button size="sm" leftIcon={<Plus size={14} />} onClick={() => { setEditing(null); setModalOpen(true); }}>New template</Button>} />
      {error && templates.length > 0 && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      {templates.length === 0 ? (
        error ? (
          <EmptyState title="Couldn't load your templates" body={error} action={<Button onClick={load}>Retry</Button>} />
        ) : (
          <EmptyState title="No templates yet" body="Save a transaction as a template to reuse it later." />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="group flex items-center justify-between rounded-xl border border-line p-3">
              <div>
                <p className="text-sm font-semibold text-fg">{t.name}</p>
                <p className="text-xs text-subtle capitalize">{t.type} · {formatCurrency(t.amount)}</p>
              </div>
              <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                <IconButton icon={Pencil} label="Edit" onClick={() => { setEditing(t); setModalOpen(true); }} />
                <IconButton icon={Trash2} variant="danger" label="Delete" onClick={() => handleDelete(t.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <TemplateModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} categories={categories} accounts={accounts} onSaved={load} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
const NOTIF_DEFAULTS = { email: true, push: true, budgetAlerts: true, billReminders: true };

function NotificationsPanel() {
  const { user, setUser } = useAuth();
  const [prefsLocal, setPrefsLocal] = useState({ ...NOTIF_DEFAULTS, ...(user?.reminderSettings || {}) });
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved' | 'error'

  async function update(patch) {
    const next = { ...prefsLocal, ...patch };
    setPrefsLocal(next);
    setSaveState('saving');
    try {
      const updated = await api.patch('/me', { reminderSettings: next });
      setUser(updated);
      setSaveState('saved');
      setTimeout(() => setSaveState(''), 1500);
    } catch {
      setSaveState('error');
    }
  }

  return (
    <Card padding="lg">
      <CardHeader
        title="Notifications"
        subtitle="In-app notifications are always on. These control email and push delivery, which is rolling out on the mobile app."
        right={saveState === 'saving' ? <span className="text-xs text-subtle">Saving…</span>
          : saveState === 'saved' ? <span className="text-xs text-emerald-500">Saved</span>
          : saveState === 'error' ? <span className="text-xs text-rose-500">Couldn’t save</span> : null}
      />
      <ToggleRow title="Email notifications" checked={prefsLocal.email} onChange={(v) => update({ email: v })} />
      <div className="divider" />
      <ToggleRow title="Push notifications" checked={prefsLocal.push} onChange={(v) => update({ push: v })} />
      <div className="divider" />
      <ToggleRow title="Budget alerts" body="Notify when a budget crosses its alert threshold." checked={prefsLocal.budgetAlerts} onChange={(v) => update({ budgetAlerts: v })} />
      <div className="divider" />
      <ToggleRow title="Bill reminders" body="Notify a few days before a bill is due." checked={prefsLocal.billReminders} onChange={(v) => update({ billReminders: v })} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
function PinModal({ open, onClose, mode, onDone }) {
  const [step, setStep] = useState('enter');
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setStep('enter');
    setPinValue('');
    setConfirm('');
    setError('');
  }, [open]);

  async function handleContinue() {
    if (pin.length < 4 || pin.length > 8) return setError('PIN must be 4–8 digits.');
    if (step === 'enter') {
      setStep('confirm');
      setError('');
      return;
    }
    if (confirm !== pin) {
      setError('PINs do not match.');
      setConfirm('');
      return;
    }
    await savePin(pin);
    onDone();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'change' ? 'Change PIN' : 'Set a PIN'} size="sm">
      <p className="mb-3 text-sm text-muted">{step === 'enter' ? 'Enter a 4–8 digit PIN.' : 'Confirm your PIN.'}</p>
      <Input
        type="password" inputMode="numeric" maxLength={8} autoFocus
        value={step === 'enter' ? pin : confirm}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '');
          step === 'enter' ? setPinValue(v) : setConfirm(v);
        }}
        placeholder="••••"
      />
      {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleContinue}>{step === 'enter' ? 'Continue' : 'Save PIN'}</Button>
      </div>
    </Modal>
  );
}

function PasswordModal({ open, onClose }) {
  const { setAccountPassword } = useAuth();
  const [password, setPasswordValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPasswordValue('');
    setConfirm('');
    setError('');
    setSaved(false);
  }, [open]);

  async function handleSave() {
    const validationError = passwordValidationError(password, confirm);
    if (validationError) return setError(validationError);
    setError('');
    setSaving(true);
    try {
      await setAccountPassword(password);
      setSaved(true);
    } catch (err) {
      setError(err.message || 'Could not set password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change password" size="sm">
      {saved ? (
        <div>
          <p className="text-sm text-muted">
            Password updated. Use your email and this password next time you sign in.
          </p>
          <Button className="mt-5" fullWidth onClick={onClose}>Done</Button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Set a new password for signing in with your email.
          </p>
          <div className="space-y-3">
            <div>
              <Input type="password" autoFocus value={password} onChange={(e) => setPasswordValue(e.target.value)} placeholder="At least 8 characters" />
              {password.length > 0 && passwordValidationError(password, password) && (
                <p className="mt-1 text-xs text-rose-500">{passwordValidationError(password, password)}</p>
              )}
            </div>
            <div>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" />
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-xs text-rose-500">Passwords do not match.</p>
              )}
              {confirm.length > 0 && isPasswordValid(password, confirm) && (
                <p className="mt-1 text-xs text-emerald-500">Passwords match.</p>
              )}
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-rose-500">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !isPasswordValid(password, confirm)}>{saving ? 'Saving…' : 'Save password'}</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Email-OTP two-factor: enable / disable. On enable, the backend also marks
// this browser's device session verified (it now sends x-session-id), so
// turning 2FA on never locks the current session out.
function TwoFactorModal({ open, onClose, enabling, onDone }) {
  const purpose = enabling ? 'enable' : 'disable';
  const [step, setStep] = useState('intro'); // intro -> code
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('intro'); setCode(''); setError(''); setBusy(false);
  }, [open]);

  async function sendCode() {
    setError(''); setBusy(true);
    try {
      await twoFactorApi.sendCode(purpose);
      setStep('code');
    } catch (err) {
      setError(err.message || 'Could not send a verification code.');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) return setError('Enter the 6-digit code from your email.');
    setError(''); setBusy(true);
    try {
      await twoFactorApi.verify(purpose, code.trim());
      onDone(enabling);
      onClose();
    } catch (err) {
      setError(
        err.message === 'incorrect_code' ? 'That code is not correct.'
        : err.message === 'code_expired_or_missing' ? 'That code has expired — start again.'
        : err.message === 'too_many_attempts' ? 'Too many attempts. Wait a few minutes.'
        : 'Could not verify that code.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={enabling ? 'Enable two-factor authentication' : 'Turn off two-factor authentication'} size="sm">
      {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      {step === 'intro' ? (
        <>
          <p className="text-sm text-muted">
            {enabling
              ? 'We’ll email you a 6-digit code now. Enter it to turn on 2FA. After that, signing in on a new device will ask for a code.'
              : 'We’ll email you a 6-digit code to confirm it’s you before turning 2FA off.'}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={sendCode} disabled={busy}>{busy ? 'Sending…' : 'Send code'}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">Enter the 6-digit code we just emailed you.</p>
          <Input
            type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456"
          />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => setStep('intro')}>Back</Button>
            <Button onClick={verify} disabled={busy || code.trim().length !== 6}>
              {busy ? 'Verifying…' : enabling ? 'Enable 2FA' : 'Turn off 2FA'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function SessionsModal({ open, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState('');
  const currentSid = getWebSessionId();

  async function load() {
    setError('');
    try {
      setRows(await sessionsApi.list());
    } catch (err) {
      setError(err.message || 'Could not load your sessions.');
      setRows([]);
    }
  }
  useEffect(() => { if (open) { setRows(null); load(); } }, [open]);

  async function revoke(id) {
    setRevoking(id);
    try {
      await sessionsApi.revoke(id);
      await load();
    } catch (err) {
      setError(err.message || 'Could not revoke that session.');
    } finally {
      setRevoking('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Active sessions" subtitle="Devices signed in to your account." size="md">
      {error && <p className="mb-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
      {rows === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No other devices are signed in.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((s) => {
            const isCurrent = s.current || s.sessionId === currentSid;
            return (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-line p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-fg">
                    <Monitor size={14} className="shrink-0 text-subtle" />
                    {s.deviceLabel || s.platform || 'Unknown device'}
                    {isCurrent && <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500">This device</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {s.platform || 'web'}
                    {s.lastSeenAt ? ` · last active ${new Date(s.lastSeenAt).toLocaleString()}` : ''}
                  </p>
                </div>
                {!isCurrent && (
                  <Button variant="danger" size="sm" disabled={revoking === s.id} onClick={() => revoke(s.id)}>
                    {revoking === s.id ? 'Revoking…' : 'Revoke'}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function SecurityPanel() {
  const { user, setUser, logout } = useAuth();
  const { prefs, setPrefs } = usePreferences();
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinSet, setPinSet] = useState(hasPin());
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [twoFaModal, setTwoFaModal] = useState(null); // null | 'enable' | 'disable'
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const twoFactorOn = !!user?.twoFactorEnabled;

  return (
    <div className="space-y-5">
      <Card padding="lg">
        <CardHeader title="PIN lock" subtitle="Require a PIN to unlock the app on this device." />
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm text-muted">
            {pinSet ? <Lock size={15} className="text-emerald-500" /> : <Unlock size={15} />}
            {pinSet ? 'PIN is set' : 'No PIN set'}
          </p>
          <div className="flex gap-2">
            {pinSet && <Button variant="outline" size="sm" onClick={() => { lockNow(); window.location.reload(); }}>Lock now</Button>}
            <Button variant="outline" size="sm" onClick={() => setPinModalOpen(true)}>{pinSet ? 'Change PIN' : 'Set PIN'}</Button>
            {pinSet && <Button variant="danger" size="sm" onClick={() => { removePin(); setPinSet(false); }}>Remove</Button>}
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Two-factor authentication" subtitle="Require an emailed 6-digit code when signing in on a new device." />
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm text-muted">
            {twoFactorOn ? <Lock size={15} className="text-emerald-500" /> : <Unlock size={15} />}
            {twoFactorOn ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
          </p>
          <Button
            variant={twoFactorOn ? 'danger' : 'primary'}
            size="sm"
            onClick={() => setTwoFaModal(twoFactorOn ? 'disable' : 'enable')}
          >
            {twoFactorOn ? 'Turn off' : 'Enable'}
          </Button>
        </div>
        <div className="divider" />
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-sm font-medium text-fg">Biometric unlock</p>
            <p className="text-xs text-subtle">Face ID / fingerprint unlock is available in the Vault mobile app.</p>
          </div>
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Automatic sign-out" subtitle="Sign out after a period of inactivity." />
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {[
            { label: 'Never', enabled: false, minutes: prefs.autoLogoutIdleMinutes },
            { label: '5 min', enabled: true, minutes: 5 },
            { label: '15 min', enabled: true, minutes: 15 },
            { label: '30 min', enabled: true, minutes: 30 },
            { label: '1 hour', enabled: true, minutes: 60 },
          ].map((opt) => {
            const active = opt.enabled ? prefs.autoLogoutEnabled && prefs.autoLogoutIdleMinutes === opt.minutes : !prefs.autoLogoutEnabled;
            return (
              <button
                key={opt.label}
                onClick={() => setPrefs({ ...prefs, autoLogoutEnabled: opt.enabled, autoLogoutIdleMinutes: opt.enabled ? opt.minutes : prefs.autoLogoutIdleMinutes })}
                className={`rounded-lg border py-2 text-xs font-medium transition ${active ? 'border-brand-500 bg-brand-500/10 text-brand-500' : 'border-line text-muted hover:bg-tint/[0.05]'}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card padding="lg">
        <CardHeader title="Password & sessions" />
        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-muted">Change password</p>
          <Button variant="outline" size="sm" onClick={() => setPwModalOpen(true)}>Change</Button>
        </div>
        <div className="divider" />
        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-muted">Active sessions</p>
          <Button variant="outline" size="sm" onClick={() => setSessionsOpen(true)}>View</Button>
        </div>
        <div className="divider" />
        <div className="flex items-center justify-between py-2">
          <p className="text-sm text-muted">Sign out of this device</p>
          <Button variant="danger" size="sm" leftIcon={<LogOut size={14} />} onClick={logout}>Sign out</Button>
        </div>
      </Card>

      <PinModal open={pinModalOpen} onClose={() => setPinModalOpen(false)} mode={pinSet ? 'change' : 'set'} onDone={() => setPinSet(true)} />
      <PasswordModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} />
      <TwoFactorModal
        open={!!twoFaModal}
        enabling={twoFaModal === 'enable'}
        onClose={() => setTwoFaModal(null)}
        onDone={(enabled) => setUser({ ...user, twoFactorEnabled: enabled, twoFactorVerified: true })}
      />
      <SessionsModal open={sessionsOpen} onClose={() => setSessionsOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
function DataPanel() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearWord, setClearWord] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null); // { tone: 'ok'|'err', text }
  const importRef = useRef(null);

  async function exportJson() {
    setMsg(null);
    setBusy('export');
    try {
      const snapshot = await dataApi.export();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vault-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg({ tone: 'err', text: err.message || 'Could not export your data.' });
    } finally {
      setBusy('');
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg(null);
    setBusy('import');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Accept either a full export ({ version, data }) or a bare bundle.
      const snapshot = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;
      const res = await dataApi.import(snapshot);
      setMsg({ tone: 'ok', text: `Restored ${Object.values(res.counts || {}).reduce((a, b) => a + b, 0)} records. Reloading…` });
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMsg({
        tone: 'err',
        text: err.status === 409
          ? 'Your account already has data. Use "Clear all data" first, then import.'
          : err.status === 413
            ? 'That backup file is too large to import.'
            : err.name === 'SyntaxError'
              ? 'That file isn’t a valid Vault export (couldn’t parse the JSON).'
              : err.message || 'Could not import that file.',
      });
    } finally {
      setBusy('');
    }
  }

  async function doClear() {
    setBusy('clear');
    try {
      await dataApi.reset();
      setConfirmClear(false);
      setMsg({ tone: 'ok', text: 'All data cleared. Reloading…' });
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setMsg({ tone: 'err', text: err.message || 'Could not clear your data.' });
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${msg.tone === 'ok' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-500'}`}>
          {msg.text}
        </p>
      )}
      <Card padding="lg">
        <CardHeader title="Export & import" subtitle="Download a full copy of your data, or restore one." />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" disabled={busy === 'export'} onClick={exportJson}>
            {busy === 'export' ? 'Preparing…' : 'Export data (JSON)'}
          </Button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
          <Button variant="outline" leftIcon={<Upload size={14} />} disabled={busy === 'import'} onClick={() => importRef.current?.click()}>
            {busy === 'import' ? 'Restoring…' : 'Import data'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-subtle">
          Import restores a previous export. It only runs on an empty account — clear your data first if needed.
        </p>
      </Card>
      <Card padding="lg" className="border-rose-500/30">
        <CardHeader title="Danger zone" />
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted">Permanently erase all accounts, transactions, budgets, bills, goals and debts. Your account stays; the data is gone.</p>
          <Button variant="danger" onClick={() => { setClearWord(''); setConfirmClear(true); }}>Clear all data</Button>
        </div>
      </Card>

      <Modal open={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all data?" subtitle="This can't be undone." size="sm">
        <p className="text-sm text-muted">
          This permanently erases every account, transaction, budget, bill, goal and debt in your workspace. Type
          <span className="font-semibold text-fg"> RESET </span> to confirm.
        </p>
        <Input className="mt-3" value={clearWord} onChange={(e) => setClearWord(e.target.value)} placeholder="RESET" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setConfirmClear(false)}>Cancel</Button>
          <Button variant="danger" disabled={clearWord.trim() !== 'RESET' || busy === 'clear'} onClick={doClear}>
            {busy === 'clear' ? 'Clearing…' : 'Clear data'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single shared implementation (components/feedback/FeedbackFormModal.jsx) —
// this used to have its own inline copy of the form, which would've drifted
// from the auto-popup's version.
function FeedbackPanel() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);

  return (
    <Card padding="lg">
      <CardHeader title="Send feedback" subtitle="Report a bug, request a feature, or tell us what's not working." />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => setShowForm(true)}>Send feedback</Button>
        <Button variant="outline" onClick={() => navigate('/app/feedback')}>View my feedback</Button>
      </div>
      <FeedbackFormModal open={showForm} onClose={() => setShowForm(false)} />
    </Card>
  );
}

function HelpPanel() {
  const navigate = useNavigate();
  const cards = [
    { title: 'Contact support', body: 'Send us a message from the feedback form above — we reply in the app.', onClick: null },
    { title: 'Report a security issue', body: 'Found a vulnerability? Use the feedback form, category “Security”.', onClick: null },
    { title: 'Your feedback & tickets', body: 'See replies and the status of anything you’ve sent us.', onClick: () => navigate('/app/feedback') },
    { title: 'Terms & Privacy', body: 'How Vault handles your data, and the terms of use.', href: '/terms' },
  ];
  return (
    <div className="space-y-5">
      <FeedbackPanel />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => {
          const interactive = !!c.onClick || !!c.href;
          const Wrapper = c.href ? 'a' : 'div';
          return (
            <Card
              key={c.title}
              hover={interactive}
              as={Wrapper}
              {...(c.href ? { href: c.href } : {})}
              {...(c.onClick ? { onClick: c.onClick, role: 'button', tabIndex: 0 } : {})}
              className={`flex items-center justify-between ${interactive ? 'cursor-pointer' : ''}`}
            >
              <div>
                <p className="font-semibold text-fg">{c.title}</p>
                <p className="mt-1 text-sm text-muted">{c.body}</p>
              </div>
              {interactive && <ChevronRight size={16} className="shrink-0 text-subtle" />}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function Settings() {
  const [section, setSection] = useState('profile');
  const { logout } = useAuth();

  const Panel = useMemo(() => ({
    profile: ProfilePanel, preferences: PreferencesPanel, categories: CategoriesPanel,
    templates: TemplatesPanel, notifications: NotificationsPanel, security: SecurityPanel,
    data: DataPanel, help: HelpPanel,
  })[section], [section]);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <div className="space-y-1">
        {SECTIONS.map((s) => (
          <button
            key={s.value} onClick={() => setSection(s.value)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${section === s.value ? 'bg-brand-500/15 text-brand-500' : 'text-muted hover:bg-tint/[0.05] hover:text-fg'}`}
          >
            <s.icon size={16} /> {s.label}
          </button>
        ))}
        <div className="divider my-2" />
        <button onClick={logout} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10">
          <LogOut size={16} /> Sign out
        </button>
      </div>
      <div>
        <Panel />
      </div>
    </div>
  );
}
