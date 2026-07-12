import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Pencil, Trash2, TrendingDown, Percent, CalendarClock, CreditCard, ArrowRight, ChevronsDown, Snowflake, Banknote,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button, Card, CardHeader, KpiCard, Chip, Modal, ConfirmDialog, IconButton, Field, Input, Select, EmptyState } from '../components/ui/index.js';
import { ChartTip } from '../components/ui/ChartTooltip.jsx';
import { debtsApi, accountsApi, transactionsApi, formatCurrency, formatDate } from '../lib/api.js';
import { notifyTxCreated, useTxCreatedListener } from '../context/NewTransactionContext.jsx';
import { useAccountsGate } from '../context/AccountsGateContext.jsx';
import { MandatoryAccountGate } from '../components/MandatoryAccountGate.jsx';

function blankForm() {
  return { name: '', creditor: '', balance: '', apr: '', minPayment: '', dueDate: '' };
}

function DebtModal({ open, onClose, editing, onSaved }) {
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editing) {
      setForm({
        name: editing.name, creditor: editing.creditor || '', balance: String(editing.balance),
        apr: String(editing.apr), minPayment: String(editing.minPayment), dueDate: editing.dueDate || '',
      });
    } else {
      setForm(blankForm());
    }
  }, [open, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required.');
    if (!(Number(form.balance) > 0)) return setError('Balance must be greater than 0.');
    setSubmitting(true);
    try {
      const payload = {
        name: form.name, creditor: form.creditor, balance: Number(form.balance),
        apr: Number(form.apr) || 0, minPayment: Number(form.minPayment) || 0, dueDate: form.dueDate || null,
      };
      if (editing) await debtsApi.update(editing.id, payload);
      else await debtsApi.create(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save this debt.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit debt' : 'New debt'} subtitle="Track outstanding balances and payoff dates." size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. HDFC Credit Card" /></Field>
        <Field label="Creditor"><Input value={form.creditor} onChange={(e) => setForm((f) => ({ ...f, creditor: e.target.value }))} placeholder="e.g. HDFC Bank" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current balance"><Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))} /></Field>
          <Field label="APR (%)"><Input type="number" step="0.1" value={form.apr} onChange={(e) => setForm((f) => ({ ...f, apr: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min payment"><Input type="number" step="0.01" value={form.minPayment} onChange={(e) => setForm((f) => ({ ...f, minPayment: e.target.value }))} /></Field>
          <Field label="Due date"><Input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editing ? 'Save changes' : 'Add debt'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({ open, onClose, debt, accounts, onPaid }) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setAmount('');
    setAccountId(accounts[0]?.id || '');
  }, [open, accounts]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!(Number(amount) > 0)) return setError('Enter an amount greater than 0.');
    if (!accountId) return setError('Select which account this is paid from.');
    setSubmitting(true);
    try {
      await debtsApi.pay(debt.id, { amount: Number(amount), accountId });
      notifyTxCreated();
      onPaid();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not record this payment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!debt) return null;

  return (
    <Modal open={open} onClose={onClose} title="Make a payment" subtitle={`Pay down ${debt.name}. Any amount is fine — it doesn't need to match a fixed EMI.`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
        <p className="text-sm text-muted">Current balance: <span className="font-semibold text-fg">{formatCurrency(debt.balance)}</span></p>
        <Field label="Amount paid"><Input type="number" step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000" /></Field>
        <Field label="Paid from account">
          <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>{submitting ? 'Recording…' : 'Record payment'}</Button>
        </div>
      </form>
    </Modal>
  );
}

function simulate(debts, extraMonthly, strategy) {
  let working = debts.map((d) => ({ ...d }));
  const timeline = [];
  let month = 0;
  let totalInterest = 0;

  while (working.some((d) => d.balance > 0.01) && month < 480) {
    month++;
    working.forEach((d) => {
      if (d.balance <= 0) return;
      const interest = d.balance * (d.apr / 100 / 12);
      d.balance += interest;
      totalInterest += interest;
    });
    working.forEach((d) => {
      if (d.balance <= 0) return;
      const pay = Math.min(d.balance, d.minPayment);
      d.balance -= pay;
    });
    const order = [...working].filter((d) => d.balance > 0);
    if (strategy === 'avalanche') order.sort((a, b) => b.apr - a.apr);
    else order.sort((a, b) => a.balance - b.balance);
    let extra = extraMonthly;
    for (const d of order) {
      if (extra <= 0) break;
      const pay = Math.min(d.balance, extra);
      d.balance -= pay;
      extra -= pay;
    }
    const total = working.reduce((s, d) => s + Math.max(0, d.balance), 0);
    timeline.push({ month, total: Math.round(total) });
  }

  const payoffMonths = timeline.length;
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + payoffMonths);
  return { timeline, payoffMonths, totalInterest: Math.round(totalInterest), payoffDate };
}

export default function Debts() {
  const [debts, setDebts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [payingDebt, setPayingDebt] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [extra, setExtra] = useState(2000);
  const [strategy, setStrategy] = useState('avalanche');
  const { loaded: accountsLoaded, hasAccounts } = useAccountsGate();

  async function load() {
    setLoadError('');
    try {
      const [list, accs, txns] = await Promise.all([debtsApi.list(), accountsApi.list(), transactionsApi.list()]);
      setDebts(list || []);
      setAccounts(accs || []);
      setTransactions(txns || []);
    } catch (err) {
      setLoadError(err.message || 'Could not load your debts.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  useTxCreatedListener(load);

  const paidByDebtId = useMemo(() => {
    const map = new Map();
    transactions.forEach((t) => {
      if (!t.sourceDebtId) return;
      map.set(t.sourceDebtId, (map.get(t.sourceDebtId) || 0) + Math.abs(t.amount));
    });
    return map;
  }, [transactions]);

  const totalDebt = useMemo(() => debts.reduce((s, d) => s + d.balance, 0), [debts]);
  const totalMin = useMemo(() => debts.reduce((s, d) => s + d.minPayment, 0), [debts]);
  const avgApr = useMemo(() => (debts.length ? debts.reduce((s, d) => s + d.apr, 0) / debts.length : 0), [debts]);

  const result = useMemo(() => (debts.length ? simulate(debts, extra, strategy) : null), [debts, extra, strategy]);
  const avalancheResult = useMemo(() => (debts.length ? simulate(debts, extra, 'avalanche') : null), [debts, extra]);
  const snowballResult = useMemo(() => (debts.length ? simulate(debts, extra, 'snowball') : null), [debts, extra]);

  const callout = useMemo(() => {
    if (!avalancheResult || !snowballResult) return null;
    const convergent = avalancheResult.payoffMonths === snowballResult.payoffMonths && Math.abs(avalancheResult.totalInterest - snowballResult.totalInterest) < 50;
    if (convergent) {
      return {
        type: 'convergent',
        text: "Both strategies produce the same result for your current debts — this usually means the highest-APR debt is also the smallest balance, so avalanche and snowball attack it in the same order. Add another debt (or edit an existing one) so the APR ranking and balance ranking differ, and you'll see the two strategies diverge.",
      };
    }
    let winner;
    if (avalancheResult.payoffMonths !== snowballResult.payoffMonths) {
      winner = avalancheResult.payoffMonths < snowballResult.payoffMonths ? 'avalanche' : 'snowball';
    } else {
      winner = avalancheResult.totalInterest <= snowballResult.totalInterest ? 'avalanche' : 'snowball';
    }
    const loser = winner === 'avalanche' ? 'snowball' : 'avalanche';
    const winnerResult = winner === 'avalanche' ? avalancheResult : snowballResult;
    const loserResult = winner === 'avalanche' ? snowballResult : avalancheResult;
    const interestSaved = Math.abs(loserResult.totalInterest - winnerResult.totalInterest);
    const monthsDiff = winnerResult.payoffMonths - loserResult.payoffMonths;
    const monthsSaved = Math.abs(monthsDiff);
    const direction = monthsDiff <= 0 ? 'sooner' : 'later';
    return { type: 'winner', winner, loser, interestSaved, monthsSaved, direction };
  }, [avalancheResult, snowballResult]);

  async function handleDelete(id) {
    await debtsApi.remove(id);
    setConfirmDelete(null);
    load();
  }

  if (loading || !accountsLoaded) return <p className="text-sm text-muted">Loading debts…</p>;
  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your debts"
        body={loadError}
        action={<Button onClick={() => { setLoading(true); load(); }}>Retry</Button>}
      />
    );
  }
  if (!hasAccounts) return <MandatoryAccountGate />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total debt" value={formatCurrency(totalDebt)} tone="rose" icon={<TrendingDown size={18} />} />
        <KpiCard label="Monthly minimum" value={formatCurrency(totalMin)} tone="amber" icon={<CreditCard size={18} />} />
        <KpiCard label="Average APR" value={`${avgApr.toFixed(1)}%`} tone="brand" icon={<Percent size={18} />} />
        <KpiCard label="Debts" value={debts.length} tone="lime" icon={<CalendarClock size={18} />} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Your debts</h2>
          <p className="text-sm text-muted">Track balances, APRs and payoff timelines.</p>
        </div>
        <Button leftIcon={<Plus size={15} />} onClick={() => { setEditing(null); setModalOpen(true); }}>Add debt</Button>
      </div>

      {debts.length === 0 ? (
        <EmptyState
          icon={<TrendingDown size={22} />} title="No debts yet" body="Add a credit card, loan or any borrowing to plan your payoff."
          action={<Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>Add debt</Button>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {debts.map((d) => (
              <Card key={d.id} hover className="group">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-display text-base font-semibold text-fg">{d.name}</p>
                    <p className="text-xs text-subtle">{d.creditor}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <IconButton icon={Pencil} label="Edit" onClick={() => { setEditing(d); setModalOpen(true); }} />
                    <IconButton icon={Trash2} variant="danger" label="Delete" onClick={() => setConfirmDelete(d)} />
                  </div>
                </div>
                <p className="mt-3 font-display text-xl font-bold text-rose-500">{formatCurrency(d.balance)}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {d.balance <= 0 ? (
                    <Chip tone="success">Paid off</Chip>
                  ) : (
                    <>
                      <Chip tone="neutral">APR {d.apr}%</Chip>
                      <Chip tone="neutral">Min pay {formatCurrency(d.minPayment)}</Chip>
                      <Chip tone="neutral">Due {d.dueDate ? formatDate(d.dueDate) : '—'}</Chip>
                    </>
                  )}
                </div>
                {paidByDebtId.has(d.id) && (
                  <p className="mt-2 text-xs text-subtle">Paid so far: <span className="font-semibold text-emerald-500">{formatCurrency(paidByDebtId.get(d.id))}</span></p>
                )}
                {d.balance > 0 && (
                  <Button size="sm" variant="outline" fullWidth className="mt-3" leftIcon={<Banknote size={14} />} onClick={() => setPayingDebt(d)}>
                    Make a payment
                  </Button>
                )}
              </Card>
            ))}
          </div>

          <Card padding="lg">
            <CardHeader title="Payoff planner" subtitle="Simulate how fast you can be debt-free." />

            <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <label className="label">Extra monthly payment (on top of minimums): {formatCurrency(extra)}</label>
                <input
                  type="range" min="0" max="20000" step="500" value={extra}
                  onChange={(e) => setExtra(Number(e.target.value))}
                  className="w-full accent-brand-500"
                />
              </div>
              <div className="w-40">
                <Input type="number" step="0.01" value={extra} onChange={(e) => setExtra(Number(e.target.value) || 0)} />
              </div>
            </div>

            <div className="mt-4 flex gap-2 rounded-xl border border-line bg-surface-2 p-1">
              {[
                { value: 'avalanche', label: 'Avalanche', hint: 'Highest APR first (saves the most)', icon: ChevronsDown },
                { value: 'snowball', label: 'Snowball', hint: 'Smallest balance first (fastest wins)', icon: Snowflake },
              ].map((s) => (
                <button
                  key={s.value} onClick={() => setStrategy(s.value)}
                  className={`flex flex-1 items-start gap-2 rounded-lg px-4 py-2.5 text-left transition ${strategy === s.value ? 'bg-brand-500 text-white shadow-glow' : 'text-muted hover:text-fg'}`}
                >
                  <s.icon size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <p className="text-sm font-semibold">{s.label}</p>
                    <p className={`text-xs ${strategy === s.value ? 'text-white/70' : 'text-subtle'}`}>{s.hint}</p>
                  </span>
                </button>
              ))}
            </div>

            {result && (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-xs text-subtle">Debt-free in</p>
                    <p className="mt-1 font-display text-lg font-bold text-brand-500">{result.payoffMonths} months</p>
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-xs text-subtle">Est. payoff date</p>
                    <p className="mt-1 font-display text-lg font-bold text-fg">{formatDate(result.payoffDate.toISOString())}</p>
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-xs text-subtle">Total interest</p>
                    <p className="mt-1 font-display text-lg font-bold text-rose-500">{formatCurrency(result.totalInterest)}</p>
                  </div>
                </div>

                <div className="mt-5 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={result.timeline} margin={{ left: -20, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} label={{ value: 'Month', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'rgb(var(--subtle))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'rgb(var(--subtle))' }} axisLine={false} tickLine={false} width={0} />
                      <Tooltip content={<ChartTip />} />
                      <Line type="monotone" dataKey="total" name="Balance" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {callout && (
              <div className="mt-5 rounded-xl border border-brand-500/25 bg-brand-500/5 p-4 text-sm">
                {callout.type === 'convergent' ? (
                  <p className="text-muted">{callout.text}</p>
                ) : (
                  <p className="text-muted">
                    <span className="font-semibold capitalize text-fg">{callout.winner}</span> saves approx.{' '}
                    <span className="font-semibold text-fg">{formatCurrency(callout.interestSaved)}</span> in interest and ends{' '}
                    <span className="font-semibold text-fg">{callout.monthsSaved} month(s)</span> {callout.direction} than {callout.loser}.
                    {strategy !== callout.winner && (
                      <button onClick={() => setStrategy(callout.winner)} className="ml-2 inline-flex items-center gap-1 font-semibold text-brand-500 hover:text-brand-400">
                        Switch to {callout.winner} <ArrowRight size={13} />
                      </button>
                    )}
                  </p>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      <DebtModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} onSaved={load} />

      <PaymentModal open={!!payingDebt} onClose={() => setPayingDebt(null)} debt={payingDebt} accounts={accounts} onPaid={load} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete debt?"
        subtitle="This just removes the debt entry from the planner."
        body={<>Are you sure you want to delete <span className="font-semibold text-fg">{confirmDelete?.name}</span>?</>}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => handleDelete(confirmDelete.id)}
      />
    </div>
  );
}
