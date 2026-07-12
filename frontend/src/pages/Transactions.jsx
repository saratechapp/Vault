import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Upload, Download, Pencil, Trash2, ArrowLeftRight, X,
} from 'lucide-react';
import { Button, Card, Select, Input, Chip, EmptyState, DynamicIcon, ConfirmDialog, IconButton } from '../components/ui/index.js';
import { transactionsApi, categoriesApi, accountsApi, goalsApi, formatCurrency, formatDate } from '../lib/api.js';
import { toCSV, downloadCSV } from '../lib/csv.js';
import { useNewTransaction, useTxCreatedListener, notifyTxCreated } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { NoAccountsTooltip } from '../components/NoAccountsTooltip.jsx';
import CsvImportModal from '../components/CsvImportModal.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';

function catMeta(categories, id) {
  return categories.find((c) => c.id === id) || { name: 'Uncategorized', color: '#64748b', icon: 'Circle' };
}
function accMeta(accounts, id) {
  return accounts.find((a) => a.id === id) || null;
}

// Reconstructs a running per-account balance so each row can show its
// statement-style previous/current balance. `transactions` comes back from
// the API sorted recent-first (date desc, insertion-order desc on ties), so
// reversing it recovers the true chronological order money actually moved in.
export function buildBalanceLedger(transactions, accounts) {
  const running = new Map(accounts.map((a) => [a.id, a.openingBalance]));
  const chronological = [...transactions].reverse();
  const ledger = new Map();
  chronological.forEach((t) => {
    if (t.type === 'transfer') {
      const fromKnown = running.has(t.fromAccountId);
      const fromBefore = fromKnown ? running.get(t.fromAccountId) : null;
      if (fromKnown) running.set(t.fromAccountId, fromBefore - t.amount);
      const toKnown = running.has(t.toAccountId);
      const toBefore = toKnown ? running.get(t.toAccountId) : null;
      if (toKnown) running.set(t.toAccountId, toBefore + t.amount);
      ledger.set(t.id, {
        from: { accountId: t.fromAccountId, before: fromBefore, after: fromKnown ? running.get(t.fromAccountId) : null },
        to: { accountId: t.toAccountId, before: toBefore, after: toKnown ? running.get(t.toAccountId) : null },
      });
    } else {
      const known = running.has(t.accountId);
      const before = known ? running.get(t.accountId) : null;
      if (known) running.set(t.accountId, before + t.amount);
      ledger.set(t.id, { accountId: t.accountId, before, after: known ? running.get(t.accountId) : null });
    }
  });
  return ledger;
}

// Picks which side of a transfer to report balances for: the filtered
// account when one is selected, otherwise the paying (from) account.
export function statementFor(t, ledger, contextAccountId) {
  const entry = ledger.get(t.id);
  if (!entry) return { previousBalance: null, currentBalance: null, displayAmount: t.amount };
  if (t.type === 'transfer') {
    const useTo = !!contextAccountId && entry.to.accountId === contextAccountId && entry.from.accountId !== contextAccountId;
    const side = useTo ? entry.to : entry.from;
    return { previousBalance: side.before, currentBalance: side.after, displayAmount: useTo ? t.amount : -t.amount };
  }
  return { previousBalance: entry.before, currentBalance: entry.after, displayAmount: t.amount };
}

const DEFAULT_FILTERS = { type: 'all', accountId: '', category: '', q: '', tag: '', goalId: '', dateFrom: '', dateTo: '', amountMin: '', amountMax: '' };
// Same quick-tag set as the New Transaction / Add Bill modals' Tags pills
// (QUICK_TAGS in NewTransactionModal.jsx and pages/Bills.jsx) — kept in sync
// so every tag a user can actually pick has a filter option and a chip here.
const TAG_OPTIONS = ['Savings', 'Investment', 'Protection', 'Expenditure', 'Income'];
const TAG_TONE = { Savings: 'brand', Expenditure: 'danger', Protection: 'info', Income: 'success', Investment: 'warning' };

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { open, openForEdit } = useNewTransaction();
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();
  const [searchParams, setSearchParams] = useSearchParams();
  const blockNoAccounts = accountsLoaded && !hasAccounts;

  useEffect(() => {
    const accountId = searchParams.get('accountId');
    if (accountId) {
      setFilters((f) => ({ ...f, accountId }));
      searchParams.delete('accountId');
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoadError('');
    try {
      const [txns, cats, accs, gls] = await Promise.all([transactionsApi.list(), categoriesApi.list(), accountsApi.list(), goalsApi.list()]);
      setTransactions(txns || []);
      setCategories(cats || []);
      setAccounts(accs || []);
      setGoals(gls || []);
    } catch (err) {
      // Without this, a single failed request (timeout, network blip, 401)
      // left Promise.all rejected and setLoading(false) never ran — the page
      // was stuck on "Loading transactions…" forever with no way out but a
      // manual refresh.
      setLoadError(err.message || 'Could not load your transactions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  useTxCreatedListener(load);

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => (k === 'type' ? v !== 'all' : !!v)).length;

  const debouncedQ = useDebouncedValue(filters.q, 200);

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.accountId && ![t.accountId, t.fromAccountId, t.toAccountId].includes(filters.accountId)) return false;
      if (filters.category && t.categoryId !== filters.category) return false;
      if (filters.tag && !(t.labels || []).includes(filters.tag)) return false;
      if (filters.goalId && t.goalId !== filters.goalId) return false;
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (filters.amountMin && Math.abs(t.amount) < Number(filters.amountMin)) return false;
      if (filters.amountMax && Math.abs(t.amount) > Number(filters.amountMax)) return false;
      if (needle) {
        const cat = catMeta(categories, t.categoryId);
        const from = accMeta(accounts, t.fromAccountId);
        const to = accMeta(accounts, t.toAccountId);
        const acc = accMeta(accounts, t.accountId);
        const haystack = [t.vendor, t.note, cat.name, t.payer, t.paymentMethod, acc?.name, from?.name, to?.name, ...(t.labels || [])]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [
    transactions, categories, accounts, debouncedQ,
    filters.type, filters.accountId, filters.category, filters.tag, filters.goalId,
    filters.dateFrom, filters.dateTo, filters.amountMin, filters.amountMax,
  ]);

  const balanceLedger = useMemo(() => buildBalanceLedger(transactions, accounts), [transactions, accounts]);

  function exportCsv() {
    const csv = toCSV(filtered, [
      { header: 'Date', value: (t) => t.date },
      { header: 'Vendor', value: (t) => t.vendor },
      { header: 'Type', value: (t) => t.type },
      { header: 'Category', value: (t) => catMeta(categories, t.categoryId).name },
      { header: 'Account', value: (t) => accMeta(accounts, t.accountId)?.name || '' },
      { header: 'From', value: (t) => accMeta(accounts, t.fromAccountId)?.name || '' },
      { header: 'To', value: (t) => accMeta(accounts, t.toAccountId)?.name || '' },
      { header: 'Amount', value: (t) => t.amount },
      { header: 'Payment method', value: (t) => t.paymentMethod || '' },
      { header: 'Note', value: (t) => t.note || '' },
      { header: 'Labels', value: (t) => (t.labels || []).join('|') },
      { header: 'Goal', value: (t) => goals.find((g) => g.id === t.goalId)?.name || '' },
    ]);
    downloadCSV(`transactions-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  async function handleDelete(id) {
    await transactionsApi.remove(id);
    setConfirmDelete(null);
    notifyTxCreated();
    load();
  }

  if (loading) return <p className="text-sm text-muted">Loading transactions…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your transactions"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] flex-1">
            <Input
              leftIcon={<Search size={15} />} placeholder="Search vendor, note, category, label, account…"
              value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <Select className="w-auto" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </Select>
          <Select className="w-auto" value={filters.accountId} onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}>
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Select className="w-auto" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select className="w-auto" value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))}>
            <option value="">All tags</option>
            {TAG_OPTIONS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
          </Select>
          <Select className="w-auto" value={filters.goalId} onChange={(e) => setFilters((f) => ({ ...f, goalId: e.target.value }))}>
            <option value="">All goals</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-500 hover:text-brand-400"
            >
              <X size={13} /> Reset filters ({activeFilterCount})
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline" size="sm" leftIcon={<Upload size={14} />}
              onClick={() => setImportOpen(true)}
              disabled={blockNoAccounts}
              title={blockNoAccounts ? 'Create an account first' : undefined}
            >
              Import
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={exportCsv} disabled={filtered.length === 0}>Export</Button>
            <NoAccountsTooltip blocked={blockNoAccounts}>
              <Button
                size="sm"
                onClick={blockNoAccounts ? undefined : open}
                aria-disabled={blockNoAccounts}
                className={blockNoAccounts ? 'opacity-60' : ''}
              >
                New transaction
              </Button>
            </NoAccountsTooltip>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Input type="date" className="w-auto" value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} placeholder="From date" />
          <Input type="date" className="w-auto" value={filters.dateTo} onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))} placeholder="To date" />
          <Input type="number" step="0.01" className="w-auto" value={filters.amountMin} onChange={(e) => setFilters((f) => ({ ...f, amountMin: e.target.value }))} placeholder="Min amount" />
          <Input type="number" step="0.01" className="w-auto" value={filters.amountMax} onChange={(e) => setFilters((f) => ({ ...f, amountMax: e.target.value }))} placeholder="Max amount" />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title={activeFilterCount > 0 ? 'No matches' : 'No transactions found'}
          body={activeFilterCount > 0 ? 'Try clearing filters or changing your search.' : 'Add a new record to get started.'}
          action={activeFilterCount > 0 ? (
            <Button variant="outline" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>
          ) : (
            <NoAccountsTooltip blocked={blockNoAccounts} side="top">
              <Button
                onClick={blockNoAccounts ? undefined : open}
                aria-disabled={blockNoAccounts}
                className={blockNoAccounts ? 'opacity-60' : ''}
              >
                New transaction
              </Button>
            </NoAccountsTooltip>
          )}
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase tracking-wide text-subtle">
                <tr>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Tag</th>
                  <th className="px-4 py-3 text-left">Account</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="border-l border-line px-4 py-3 text-right">Previous balance</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Current balance</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const cat = catMeta(categories, t.categoryId);
                  const isTransfer = t.type === 'transfer';
                  const from = accMeta(accounts, t.fromAccountId);
                  const to = accMeta(accounts, t.toAccountId);
                  const acc = accMeta(accounts, t.accountId);
                  const stmt = statementFor(t, balanceLedger, filters.accountId || null);
                  const amountTone = stmt.displayAmount < 0 ? 'text-rose-500' : 'text-emerald-500';
                  const tags = TAG_OPTIONS.filter((tag) => (t.labels || []).includes(tag));
                  return (
                    <tr key={t.id} className="group border-t border-line hover:bg-tint/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-fg">{t.vendor}</p>
                        {t.note && <p className="text-xs text-subtle">{t.note}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <Chip style={{ color: cat.color, borderColor: `${cat.color}40`, background: `${cat.color}15` }} leftIcon={<DynamicIcon name={cat.icon} size={12} />}>
                          {cat.name}
                        </Chip>
                      </td>
                      <td className="px-4 py-3">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tags.map((tag) => <Chip key={tag} tone={TAG_TONE[tag]}>{tag}</Chip>)}
                          </div>
                        ) : (
                          <span className="text-subtle">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {isTransfer ? (
                          <span className="flex items-center gap-1 text-xs">
                            {from?.name || '—'} <ArrowLeftRight size={11} /> {to?.name || t.vendor || '—'}
                            {t.goalId && <Chip tone="brand" className="ml-1">Goal</Chip>}
                          </span>
                        ) : (
                          acc?.name || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted">{formatDate(t.date)}</td>
                      <td className="border-l border-line px-4 py-3 text-right tabular-nums text-subtle">
                        {stmt.previousBalance == null ? '—' : formatCurrency(stmt.previousBalance)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${amountTone}`}>
                        {stmt.displayAmount < 0 ? '-' : '+'}{formatCurrency(Math.abs(stmt.displayAmount))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-fg">
                        {stmt.currentBalance == null ? '—' : formatCurrency(stmt.currentBalance)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <IconButton icon={Pencil} label="Edit" onClick={() => openForEdit(t)} />
                          <IconButton icon={Trash2} variant="danger" label="Delete" onClick={() => setConfirmDelete(t)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} categories={categories} accounts={accounts} onImported={load} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete transaction?"
        body="Are you sure you want to delete this transaction? This can't be undone."
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
