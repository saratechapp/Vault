import { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles, ShieldCheck, Clock } from 'lucide-react';
import { Card, Alert, Button, Skeleton, Select } from '../components/ui/index.js';
import { subscriptionApi } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  SUBSCRIPTION_STATUS,
  daysRemaining,
  formatDate,
  currencyFlag,
} from '../lib/subscription.js';

const MONTHLY_FEATURES = [
  'Every feature, no limits',
  'AI insights & reports',
  'Priority email support',
  'Cancel anytime',
];
const YEARLY_FEATURES = [
  'Everything in Monthly',
  'Two months effectively free',
  'Locked-in price for a year',
  'Cancel anytime',
];

export default function Subscription() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switching, setSwitching] = useState(false);
  const [cta, setCta] = useState('');

  const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;

  useEffect(() => {
    let cancelled = false;
    subscriptionApi
      .get(locale)
      .then((fresh) => {
        if (!cancelled) setData(fresh);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load subscription plans.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // locale is stable for the session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeCurrency(code) {
    if (!code || code === data?.pricing?.selected?.code) return;
    setSwitching(true);
    try {
      const res = await subscriptionApi.setCurrency(code);
      setData((d) => ({ ...d, pricing: res.pricing }));
    } catch (err) {
      setError(err.message || 'Could not change currency.');
    } finally {
      setSwitching(false);
    }
  }

  const status = data?.status || user?.subscription?.status || SUBSCRIPTION_STATUS.FREE_ACCESS;
  const pricing = data?.pricing || null;
  const selected = pricing?.selected || null;
  // Paid plans are only live when the Super Admin has turned subscription
  // enforcement ON. With it OFF the app is free for everyone, so the
  // Monthly/Yearly section is disabled (shown as an inactive preview).
  const paidPlansActive = !!data?.enforcementEnabled;

  const banner = useMemo(() => {
    if (status === SUBSCRIPTION_STATUS.EXPIRED) {
      return {
        tone: 'warning',
        icon: <Clock size={17} />,
        title: 'Your free trial has ended',
        body: data?.enforcementEnabled
          ? 'Choose a plan below to continue using premium features.'
          : 'Your access continues unchanged — no plan is required right now.',
      };
    }
    if (status === SUBSCRIPTION_STATUS.ACTIVE) {
      return {
        tone: 'success',
        icon: <ShieldCheck size={17} />,
        title: `You're subscribed${data?.subscriptionEndDate ? ` · renews ${formatDate(data.subscriptionEndDate)}` : ''}`,
        body: 'Thanks for supporting the app.',
      };
    }
    return null;
  }, [status, data]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-5 md:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-fg">
          {paidPlansActive ? 'Choose your plan' : 'Your plan'}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {paidPlansActive
            ? 'Start free, then pick monthly flexibility or save with yearly.'
            : 'The app is free for everyone right now — no subscription required.'}
        </p>
      </div>

      {error && (
        <Alert tone="danger" title="Something went wrong" className="mt-5">{error}</Alert>
      )}

      {banner && (
        <div className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          banner.tone === 'warning' ? 'border-amber-500/30 bg-amber-500/10'
          : banner.tone === 'success' ? 'border-emerald-500/25 bg-emerald-500/10'
          : 'border-brand-500/25 bg-brand-500/10'
        }`}>
          <span className={
            banner.tone === 'warning' ? 'text-amber-500'
            : banner.tone === 'success' ? 'text-emerald-500' : 'text-brand-500'
          }>{banner.icon}</span>
          <span>
            <span className="font-semibold text-fg">{banner.title}</span>
            <span className="mt-0.5 block text-muted">{banner.body}</span>
          </span>
        </div>
      )}

      {/* Currency selector */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-subtle">Currency</span>
        {pricing?.currencies?.length ? (
          <Select
            value={selected?.code}
            disabled={switching}
            onChange={(e) => changeCurrency(e.target.value)}
            className="w-44"
          >
            {pricing.currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {`${currencyFlag(c.code)}  ${c.code} ${c.symbol}`}
              </option>
            ))}
          </Select>
        ) : (
          <span className="text-sm text-muted">—</span>
        )}
        {pricing?.source && pricing.source !== 'default' && (
          <span className="text-xs text-subtle">detected from your {pricing.source}</span>
        )}
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <FreePlanCard
          status={status}
          trial={data?.trial}
          trialStartDate={data?.trialStartDate || user?.subscription?.trialStartDate}
          trialEndDate={data?.trialEndDate || user?.subscription?.trialEndDate}
        />

        {!pricing?.configured || !selected ? (
          <Alert tone="info" title="Paid plans are being finalised" className="md:col-span-2">
            Monthly and yearly pricing hasn’t been published yet. You’ll see them here as soon
            as it is — your access is unaffected.
          </Alert>
        ) : !paidPlansActive ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-tint/[0.03] p-8 text-center md:col-span-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-tint/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-subtle">
              Not active
            </span>
            <p className="mt-3 font-display text-lg font-semibold text-fg">Monthly &amp; yearly plans</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Paid subscriptions aren’t required right now — the app is free for everyone. These
              plans activate only if the team turns subscription enforcement on.
            </p>
            <p className="mt-3 text-xs text-subtle">
              Preview · {selected.monthlyFormatted}/mo · {selected.yearlyFormatted}/yr
            </p>
          </div>
        ) : (
          <>
            <PlanCard
              name="Monthly"
              price={selected.monthlyFormatted}
              per="per month"
              features={MONTHLY_FEATURES}
              cta="Subscribe monthly"
              onCta={() => setCta('monthly')}
            />
            <PlanCard
              highlight
              badge="Best value"
              name="Yearly"
              price={selected.yearlyFormatted}
              per="per year"
              note={
                selected.yearlySavingsPct > 0
                  ? `Save ${selected.yearlySavingsPct}% vs monthly · ≈ ${selected.yearlyEquivalentMonthlyFormatted}/mo`
                  : `≈ ${selected.yearlyEquivalentMonthlyFormatted}/mo`
              }
              features={YEARLY_FEATURES}
              cta="Subscribe yearly"
              onCta={() => setCta('yearly')}
            />
          </>
        )}
      </div>

      {cta && (
        <Alert tone="info" title="Billing is coming soon" className="mt-5">
          Paid subscriptions aren’t live yet, so the {cta} plan can’t be purchased right now.
          Your access is unaffected — we’ll enable checkout here when it’s ready.
        </Alert>
      )}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-subtle">
        <ShieldCheck size={13} /> Secure &amp; flexible · cancel anytime · prices set per market, never auto-converted
      </p>
    </div>
  );
}

// The "Free" plan card. Adapts to the current state:
//  - trial OFF                -> "Free", the current tier
//  - trial ON, user on trial  -> "Free trial", big "N days left" + the exact
//                                "Free until {date}" the backend computed
//                                (trialStart + configured duration)
//  - trial ON, user expired   -> "Free trial", "Trial ended {date}"
//  - user on a paid plan      -> plain "Free / ₹0", no "current" badge
// Every date/number here comes from the API — the duration and the end date
// are computed server-side (subscriptionService.addMonths); nothing is
// hardcoded on the frontend.
function FreePlanCard({ status, trial, trialStartDate, trialEndDate }) {
  const onTrial = status === SUBSCRIPTION_STATUS.FREE_TRIAL;
  const expired = status === SUBSCRIPTION_STATUS.EXPIRED;
  const isCurrent = status === SUBSCRIPTION_STATUS.FREE_ACCESS || onTrial;
  const trialEnabled = !!trial?.enabled;
  const months = trial?.durationMonths || 1;
  const left = onTrial ? daysRemaining(trialEndDate) : 0;

  const name = trialEnabled && (onTrial || expired) ? 'Free trial' : 'Free';

  const features = [
    'Core budgeting, accounts & bills',
    'Reports, calendar & notifications',
    trialEnabled ? `${months}-month free trial on signup` : 'Free for personal use',
  ];

  let statusPill;
  if (status === SUBSCRIPTION_STATUS.FREE_ACCESS) statusPill = { label: 'Your current plan', cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500' };
  else if (expired) statusPill = { label: 'Trial ended', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-500' };
  else if (onTrial) statusPill = { label: 'Subscribe anytime — no gap in access', cls: 'border-line bg-tint/[0.04] text-muted' };
  else statusPill = { label: 'Included', cls: 'border-line bg-tint/[0.04] text-muted' };

  return (
    <Card padding="none" className={`relative flex flex-col overflow-hidden ${isCurrent ? 'ring-2 ring-emerald-500/60' : ''}`}>
      <div className="flex flex-1 flex-col p-6">
        <h2 className="font-display text-lg font-bold text-fg">{name}</h2>

        {onTrial ? (
          /* Highlighted trial notification — the countdown + the exact
             backend-computed "valid until" date, called out in an emerald
             panel so it stands apart from the plan copy. */
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-500">
              <Sparkles size={12} /> Free trial active
            </p>
            <p className="mt-1.5 flex items-end gap-1.5">
              <span className="font-display text-4xl font-bold text-fg">{left}</span>
              <span className="pb-1 text-sm text-emerald-600 dark:text-emerald-400">{left === 1 ? 'day left' : 'days left'}</span>
            </p>
            <p className="mt-2 text-sm text-fg">
              Free until <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatDate(trialEndDate)}</span>
            </p>
            {trialStartDate && (
              <p className="mt-0.5 text-xs text-subtle">Trial started {formatDate(trialStartDate)}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end gap-1.5">
              <span className="font-display text-4xl font-bold text-fg">Free</span>
              <span className="pb-1 text-sm text-muted">₹0 forever</span>
            </div>
            {expired && (
              <p className="mt-2 text-sm font-medium text-amber-500">Trial ended {formatDate(trialEndDate)}</p>
            )}
            {!expired && trialEnabled && (
              /* Highlighted so a free-access user sees upfront that a trial
                 exists and for how long — the duration comes from the backend
                 subscription config (trial.durationMonths). */
              <div className="mt-4 rounded-xl border border-brand-500/40 bg-gradient-to-br from-brand-500/15 to-brand-500/5 p-4">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-500">
                  <Sparkles size={12} /> Free trial included
                </p>
                <p className="mt-1.5 text-sm font-semibold text-fg">New accounts get a {months}-month free trial</p>
                <p className="mt-0.5 text-xs text-muted">Full access during the trial, then choose a plan to continue.</p>
              </div>
            )}
          </>
        )}

        <div className={`mt-5 rounded-xl border px-4 py-2.5 text-center text-sm font-semibold ${statusPill.cls}`}>
          {statusPill.label}
        </div>

        <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-fg">
              <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function PlanCard({ name, price, per, note, features, cta, onCta, highlight = false, badge }) {
  return (
    <Card
      padding="none"
      className={`relative flex flex-col overflow-hidden ${highlight ? 'ring-2 ring-brand-500' : ''}`}
    >
      {highlight && (
        <div className="h-1.5 w-full bg-gradient-to-r from-brand-400 via-accent-purple to-accent-cyan" />
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-fg">{name}</h2>
          {badge && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-500">
              <Sparkles size={11} /> {badge}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end gap-1.5">
          <span className="font-display text-4xl font-bold text-fg">{price}</span>
          <span className="pb-1 text-sm text-muted">{per}</span>
        </div>
        {note && <p className="mt-1 text-xs font-medium text-brand-500">{note}</p>}

        <Button className="mt-5" fullWidth variant={highlight ? 'primary' : 'outline'} onClick={onCta}>
          {cta}
        </Button>

        <ul className="mt-6 space-y-2.5 border-t border-line pt-5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-fg">
              <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
