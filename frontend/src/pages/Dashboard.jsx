import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { Plus, RotateCcw, Settings2, Check, X, GripVertical, LineChart } from 'lucide-react';
import { Button, Card, CardHeader, Modal, EmptyState, Chip, Skeleton, SkeletonCard } from '../components/ui/index.js';
import { FadeIn, SlideUp } from '../components/motion/index.js';
import { GlowCard } from '../components/GlowCard.jsx';
import { dashboardApi, accountsApi, categoriesApi, aiApi, formatCurrency } from '../lib/api.js';
import { useTxCreatedListener } from '../context/NewTransactionContext.jsx';
import { useDashboardLayout } from './dashboard/useDashboardLayout.js';
import { useAccountOrder } from './dashboard/useAccountOrder.js';
import { WIDGET_REGISTRY, CashFlowWidget } from './dashboard/widgets.jsx';
import { AIDailySummaryCard } from './dashboard/aiWidgets.jsx';

function spanClass(span) {
  if (span >= 3) return 'md:col-span-2 xl:col-span-3';
  if (span === 2) return 'md:col-span-2';
  return '';
}
// Small / Medium / Large / Full-width, per the doc's resize-handle spec.
// Large and Full-width render identically today since the grid tops out at
// 3 columns (xl:grid-cols-3) — a true 4th tier would need a wider ≥1536px
// breakpoint, which isn't added here to avoid changing how existing
// full-width widgets (span 3) lay out on very large screens.
const SPAN_LABELS = { 1: 'S', 2: 'M', 3: 'L', 4: 'Full' };

const WIDGET_CATEGORY_ORDER = [
  'Spending & Budgets', 'Cash Flow & Trends', 'Bills & Reminders',
  'Goals & Savings', 'Insights & Health Score', 'Accounts & Vendors',
];

function accountTrend(monthNet) {
  if (!monthNet) return { direction: 'flat', label: '' };
  return {
    direction: monthNet > 0 ? 'up' : 'down',
    label: `${monthNet > 0 ? '+' : '-'}${formatCurrency(Math.abs(monthNet))}`,
  };
}

// Drag to reorder, pin to keep an account first — persisted per-browser via
// useAccountOrder. Each card drills into that specific account's transaction
// history (AccountDetails), not the generic accounts list.
function AccountsStrip({ accounts }) {
  const accountIds = accounts.map((a) => a.id);
  const { orderedIds, pinned, moveId, togglePin } = useAccountOrder(accountIds);
  const [dragId, setDragId] = useState(null);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);

  if (!accounts.length) {
    return (
      <Link
        to="/app/accounts"
        data-tour="add-account-cta"
        className="flex h-24 items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-sm font-medium text-subtle transition hover:border-line-strong hover:text-fg"
      >
        <Plus size={16} /> Add your first account
      </Link>
    );
  }
  return (
    <div className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
      {ordered.map((a) => (
        <div
          key={a.id}
          className={`shrink-0 snap-start transition ${dragId === a.id ? 'scale-[0.98] opacity-50' : ''}`}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            setDragId(a.id);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) moveId(dragId, a.id);
            setDragId(null);
          }}
          onDragEnd={() => setDragId(null)}
        >
          <GlowCard
            href={`/app/accounts/${a.id}`}
            color={a.color}
            Icon={LucideIcons[a.icon] || LucideIcons.Circle}
            title={a.name}
            value={formatCurrency(a.balance)}
            subtitle={`${(a.type || '').toUpperCase()}${a.institution ? ` · ${a.institution}` : ''}`}
            negative={a.balance < 0}
            trend={accountTrend(a.monthNet)}
            pinned={pinned.has(a.id)}
            onTogglePin={() => togglePin(a.id)}
          />
        </div>
      ))}
      <Link
        to="/app/accounts"
        data-tour="add-account-cta"
        className="flex w-[180px] shrink-0 snap-start items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line text-sm font-medium text-subtle transition hover:border-line-strong hover:text-fg"
      >
        <Plus size={15} /> Add account
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [aiData, setAiData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const { layout, activePreset, presetNames, add, remove, move, cycleSpan, reset, switchPreset } = useDashboardLayout();

  async function load() {
    setLoadError('');
    try {
      // AI insights are fetched separately and never allowed to fail the core
      // dashboard load — if it errors, the rest of the page still renders.
      const [dash, accs, cats, ai] = await Promise.all([
        dashboardApi.get(), accountsApi.list(), categoriesApi.list(), aiApi.insights().catch(() => null),
      ]);
      setData(dash);
      setAccounts(accs || []);
      setCategories(cats || []);
      setAiData(ai);
    } catch (err) {
      // Without this, a failed request (timeout, network blip, 401) left
      // `data` null forever — the page was stuck on the loading skeleton
      // with no error and no way to recover but a manual refresh.
      setLoadError(err.message || 'Could not load your dashboard.');
    }
  }

  useEffect(() => {
    load();
  }, []);
  useTxCreatedListener(load);

  if (loadError) {
    return (
      <EmptyState
        title="Couldn't load your dashboard"
        body={loadError}
        action={<Button onClick={load}>Retry</Button>}
      />
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-[220px] shrink-0 rounded-2xl" />)}
        </div>
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const widgetData = { ...data, ...(aiData || {}), categories };

  return (
    <div className="space-y-6">
      <FadeIn>
        <AccountsStrip accounts={accounts} />
      </FadeIn>

      <SlideUp className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-fg">Overview</h2>
          <p className="text-sm text-muted">Your custom widgets, arranged your way.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
            {presetNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => switchPreset(name)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${activePreset === name ? 'bg-brand-500 text-white shadow-glow' : 'text-muted hover:text-fg'}`}
              >
                {name}
              </button>
            ))}
          </div>
          {editing && (
            <>
              <Button variant="outline" size="sm" leftIcon={<RotateCcw size={14} />} onClick={reset}>Reset</Button>
            </>
          )}
          <Button variant="outline" size="sm" leftIcon={<Plus size={14} />} onClick={() => setPickerOpen(true)}>Add card</Button>
          <Button
            size="sm"
            variant={editing ? 'primary' : 'outline'}
            leftIcon={editing ? <Check size={14} /> : <Settings2 size={14} />}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? 'Done' : 'Customize'}
          </Button>
        </div>
      </SlideUp>

      <div data-tour="dashboard-overview" className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="flex h-full flex-col">
            <CardHeader
              title="Cash flow"
              subtitle="Expenditure, Protection, Income & Investment across the year"
              right={<LineChart size={16} className="text-subtle" />}
            />
            <div className="flex flex-1 flex-col justify-center">
              <CashFlowWidget data={widgetData} />
            </div>
          </Card>
        </div>
        <div data-tour="ai-insights" className="xl:col-span-1">
          <AIDailySummaryCard items={aiData?.dailySummary} />
        </div>
      </div>

      {layout.length === 0 ? (
        <EmptyState
          title="Your dashboard is empty"
          body="Add a card to start building your view."
          action={<Button leftIcon={<Plus size={15} />} onClick={() => setPickerOpen(true)}>Add a card</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {layout.map((w) => {
            const meta = WIDGET_REGISTRY[w.type];
            if (!meta) return null;
            const Icon = meta.icon;
            const Component = meta.Component;
            const isDragging = dragId === w.id;
            const isOver = overId === w.id && dragId && dragId !== w.id;
            return (
              <div
                key={w.id}
                className={`${spanClass(w.span)} transition ${isDragging ? 'scale-[0.98] opacity-40' : ''} ${isOver ? 'rounded-2xl ring-2 ring-brand-500' : ''}`}
                draggable={editing}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', w.id);
                  setDragId(w.id);
                }}
                onDragOver={(e) => {
                  if (!editing) return;
                  e.preventDefault();
                  setOverId(w.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId) move(dragId, w.id);
                  setDragId(null);
                  setOverId(null);
                }}
              >
                <Card className={`flex h-full flex-col ${editing ? 'border-dashed' : ''}`}>
                  <CardHeader
                    title={meta.title}
                    subtitle={meta.subtitle}
                    right={
                      <div className="flex items-center gap-1">
                        {!editing && <Icon size={16} className="text-subtle" />}
                        {editing && (
                          <>
                            <button
                              type="button"
                              onClick={() => cycleSpan(w.id)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-tint/[0.06] hover:text-fg"
                              title="Cycle width: Small / Medium / Large / Full-width"
                            >
                              {SPAN_LABELS[w.span] || w.span}
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(w.id)}
                              className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                              title="Remove"
                            >
                              <X size={14} />
                            </button>
                            <span className="cursor-grab rounded-lg p-1.5 text-subtle" title="Drag to reorder">
                              <GripVertical size={14} />
                            </span>
                          </>
                        )}
                      </div>
                    }
                  />
                  <div className="flex flex-1 flex-col justify-center">
                    <Component data={widgetData} categories={categories} accounts={accounts} />
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Add a card"
        subtitle="Pick from the widget library. You can add each widget more than once."
        size="lg"
      >
        <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
          {WIDGET_CATEGORY_ORDER.map((category) => {
            const entries = Object.entries(WIDGET_REGISTRY).filter(([, meta]) => (meta.category || 'Other') === category);
            if (!entries.length) return null;
            return (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{category}</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {entries.map(([type, meta]) => {
                    const Icon = meta.icon;
                    const added = layout.some((w) => w.type === type);
                    return (
                      <div key={type} className="flex items-start gap-3 rounded-xl border border-line p-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/15 text-brand-500">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-fg">{meta.title}</p>
                            {added && <Chip tone="success">Added</Chip>}
                          </div>
                          {meta.subtitle && <p className="mt-1 text-xs text-muted">{meta.subtitle}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => add(type, meta.defaultSpan)}
                          className="shrink-0 rounded-lg p-1.5 text-muted transition hover:bg-brand-500/10 hover:text-brand-500"
                          title={`Add ${meta.title}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
