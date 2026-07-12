import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, TrendingUp, TrendingDown, Receipt, ArrowLeftRight, Landmark,
} from 'lucide-react';
import { Button, Card, KpiCard, Chip, ProgressBar, EmptyState, DynamicIcon, Toggle } from '../components/ui/index.js';
import { accountsApi, categoriesApi, transactionsApi, formatCurrency, formatDate } from '../lib/api.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';

function catMeta(categories, id) {
  return categories.find((c) => c.id === id) || { name: 'Uncategorized', color: '#64748b', icon: 'Circle' };
}

// A transfer's amount is always stored positive regardless of direction, so
// whether it's money in or out depends on which side of the transfer *this*
// account sits on — not the raw sign of the amount.
function isInflowForAccount(t, accountId) {
  if (t.type === 'transfer') return t.toAccountId === accountId;
  return t.amount >= 0;
}

// Running total for a set of category ids, scoped to the transactions passed
// in (here: only the ones touching this account). Mirrors the backend's
// computeCategories ledger — every transaction's magnitude adds to the total,
// so "Available Amount" always reflects Previous Total + Latest Transaction.
export function ledgerForIds(transactions, idSet, accountId) {
  const rows = transactions.filter((t) => idSet.has(t.categoryId));
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));
  const total = rows.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const inflow = rows.reduce((sum, t) => sum + (isInflowForAccount(t, accountId) ? Math.abs(t.amount) : 0), 0);
  const outflow = rows.reduce((sum, t) => sum + (!isInflowForAccount(t, accountId) ? Math.abs(t.amount) : 0), 0);
  const last = Math.abs(sorted[0].amount);
  return { total, previous: total - last, last, lastDate: sorted[0].date, count: rows.length, inflow, outflow };
}

// Parent categories roll up their sub-categories' transactions into one
// total (same rule the budget breakdown uses), while each sub-category also
// gets its own scoped total for the nested row.
// A recurring bill posted as a transfer (e.g. "Health Insurance Premium"
// paid from Salary Account into savings) always lands in the generic
// "Transfer" category server-side — transfers have no sub-categories of
// their own to preserve the bill's specific purpose. Without this, every
// such bill collapses into one lump "Transfer" total with no way to tell
// Medical apart from Electricity apart from Upskilling. Since vendor name is
// the one thing that still distinguishes them, break the Transfer bucket
// down by vendor instead of leaving it as a single flat number.
export function buildAccountCategoryLedger(transactions, categories, accountId) {
  const parents = categories.filter((c) => !c.parentId);
  return parents
    .map((parent) => {
      const children = categories.filter((c) => c.parentId === parent.id);
      const ledger = ledgerForIds(transactions, new Set([parent.id, ...children.map((c) => c.id)]), accountId);
      if (!ledger) return null;
      let childRows = children
        .map((c) => {
          const childLedger = ledgerForIds(transactions, new Set([c.id]), accountId);
          return childLedger ? { id: c.id, name: c.name, icon: c.icon, color: c.color, ...childLedger } : null;
        })
        .filter(Boolean);
      // Categories are Postgres uuids now, not fixed strings like the old
      // 'cat_transfer' — the system Transfer category has to be matched by
      // name instead.
      if (childRows.length === 0 && parent.name === 'Transfer') {
        const byVendor = new Map();
        transactions.filter((t) => t.categoryId === parent.id).forEach((t) => {
          const key = t.vendor || 'Transfer';
          if (!byVendor.has(key)) byVendor.set(key, 0);
          byVendor.set(key, byVendor.get(key) + Math.abs(t.amount));
        });
        childRows = [...byVendor.entries()]
          .map(([vendor, total]) => ({ id: `vendor-${vendor}`, name: vendor, icon: parent.icon, color: parent.color, total }))
          .sort((a, b) => b.total - a.total);
      }
      return { id: parent.id, name: parent.name, icon: parent.icon, color: parent.color, ...ledger, children: childRows };
    })
    .filter(Boolean);
}

export default function AccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [account, setAccount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [categoryLedger, setCategoryLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showMoneyIn, setShowMoneyIn] = useState(true);
  const [showMoneyOut, setShowMoneyOut] = useState(false);

  async function load() {
    setLoadError('');
    try {
      const [accounts, cats, txns] = await Promise.all([accountsApi.list(), categoriesApi.list(), transactionsApi.list()]);
      const found = (accounts || []).find((a) => a.id === id);
      if (!found) {
        setNotFound(true);
        return;
      }
      setAccount(found);
      setCategories(cats || []);
      const scopedTxns = (txns || []).filter((t) => [t.accountId, t.fromAccountId, t.toAccountId].includes(id));
      setTransactions(scopedTxns);
      setCategoryLedger(buildAccountCategoryLedger(scopedTxns, cats || [], id));
    } catch (err) {
      // Distinct from `notFound` — a failed fetch used to fall through to
      // "Account not found. This account may have been deleted.", which is
      // wrong and misleading for what's actually a network/timeout error.
      setLoadError(err.message || 'Could not load this account.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);
  useTxCreatedListener(load);

  if (loading) return <p className="text-sm text-muted">Loading account…</p>;

  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load this account"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }

  if (notFound || !account) {
    return (
      <EmptyState
        icon={<Landmark size={22} />} title="Account not found" body="This account may have been deleted."
        action={<Button onClick={() => navigate('/app/accounts')}>Back to accounts</Button>}
      />
    );
  }

  const recent = transactions.slice(0, 8);
  const visibleCategoryLedger = categoryLedger.filter(
    (cat) => (showMoneyIn && cat.inflow > 0) || (showMoneyOut && cat.outflow > 0)
  );

  return (
    <div className="space-y-6">
      <Link to="/app/accounts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-fg">
        <ArrowLeft size={15} /> Back to accounts
      </Link>

      <Card padding="lg" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full blur-3xl" style={{ background: account.color, opacity: 0.18 }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: `${account.color}22`, color: account.color }}>
              <DynamicIcon name={account.icon} size={26} />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-fg">{account.name}</h2>
              <p className="text-sm text-subtle">{account.institution || account.type} · {account.currency}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Current balance</p>
            <p className={`font-display text-3xl font-bold ${account.balance < 0 ? 'text-rose-500' : 'text-fg'}`}>{formatCurrency(account.balance)}</p>
            {account.lastTransactionDate && (
              <p className="mt-1 text-xs text-subtle">
                {formatCurrency(account.previousBalance)} {account.lastTransactionAmount >= 0 ? '+' : '−'} {formatCurrency(Math.abs(account.lastTransactionAmount))}
              </p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Money in" value={formatCurrency(account.inflow)} tone="lime" icon={<TrendingUp size={18} />} />
        <KpiCard label="Money out" value={formatCurrency(account.outflow)} tone="rose" icon={<TrendingDown size={18} />} />
        <KpiCard label="Transactions" value={account.txnCount} tone="cyan" icon={<Receipt size={18} />} />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-fg">Category balances</h3>
            <p className="text-sm text-muted">Available amount per category and sub-category, from every transaction posted to this account.</p>
          </div>
          <div className="flex items-center gap-5 text-xs font-medium text-muted">
            <span className="flex items-center gap-2">
              Money in
              <Toggle checked={showMoneyIn} onChange={setShowMoneyIn} tone="success" label="Show only categories with money in" />
            </span>
            <span className="flex items-center gap-2">
              Money out
              <Toggle checked={showMoneyOut} onChange={setShowMoneyOut} tone="danger" label="Show only categories with money out" />
            </span>
          </div>
        </div>
        {visibleCategoryLedger.length === 0 ? (
          <EmptyState
            icon={<Receipt size={20} />} title={categoryLedger.length === 0 ? 'No categorized transactions yet' : 'No categories match'}
            body={categoryLedger.length === 0
              ? 'Once you record a transaction on this account with a category, its running total shows up here.'
              : 'Turn on Money in or Money out above to see matching categories.'}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCategoryLedger.map((cat) => {
              const flowTotal = cat.inflow + cat.outflow;
              const inPct = flowTotal > 0 ? (cat.inflow / flowTotal) * 100 : 0;
              return (
                <Card key={cat.id} hover padding="lg" className="group relative overflow-hidden">
                  <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl" style={{ background: cat.color, opacity: 0.16 }} />
                  <div className="relative flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cat.color}22`, color: cat.color }}>
                        <DynamicIcon name={cat.icon} size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-sm font-semibold text-fg">{cat.name}</p>
                        <p className="text-xs text-subtle">{cat.count} txn{cat.count === 1 ? '' : 's'}</p>
                      </div>
                    </div>
                  </div>

                  <p className="relative mt-4 font-display text-2xl font-bold tabular-nums text-fg">{formatCurrency(cat.total)}</p>
                  <p className="relative mt-1 text-xs tabular-nums text-subtle">
                    {formatCurrency(cat.previous)} <span className="font-semibold text-emerald-500">+ {formatCurrency(cat.last)}</span>
                  </p>

                  <ProgressBar value={inPct} color={cat.color} size="sm" className="relative mt-4" />
                  {(showMoneyIn || showMoneyOut) && (
                    <div className="relative mt-2.5 flex items-center gap-2">
                      {showMoneyIn && <Chip tone="success">In {formatCurrency(cat.inflow)}</Chip>}
                      {showMoneyOut && <Chip tone="danger">Out {formatCurrency(cat.outflow)}</Chip>}
                    </div>
                  )}

                  {cat.children.length > 0 && (
                    <div className="relative mt-4 space-y-2 border-t border-line pt-3">
                      {cat.children.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ background: `${c.color}22`, color: c.color }}>
                              <DynamicIcon name={c.icon} size={11} />
                            </span>
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="shrink-0 text-xs font-semibold tabular-nums text-fg">{formatCurrency(c.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-fg">Recent activity</h3>
            <p className="text-sm text-muted">Latest transactions on {account.name}.</p>
          </div>
          <Link to={`/app/transactions?accountId=${account.id}`} className="shrink-0 text-xs font-semibold text-brand-500 link-underline">View all →</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={20} />} title="No transactions yet" body="Nothing recorded on this account." />
        ) : (
          <div className="space-y-2">
            {recent.map((t) => {
              const cat = catMeta(categories, t.categoryId);
              const isTransfer = t.type === 'transfer';
              const signed = t.type === 'expense'
                ? -Math.abs(t.amount)
                : t.type === 'income'
                ? Math.abs(t.amount)
                : t.fromAccountId === account.id ? -Math.abs(t.amount) : Math.abs(t.amount);
              return (
                <Card key={t.id} padding="sm" className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cat.color}18`, color: cat.color }}>
                      <DynamicIcon name={cat.icon} size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{t.vendor || cat.name}</p>
                      <p className="text-xs text-subtle">{formatDate(t.date)} · {cat.name}</p>
                    </div>
                  </div>
                  <p className={`shrink-0 font-display text-sm font-bold tabular-nums ${signed < 0 ? 'text-rose-500' : isTransfer ? 'text-cyan-500' : 'text-emerald-500'}`}>
                    {signed < 0 ? '-' : '+'}{formatCurrency(Math.abs(signed))}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
