import { useNavigate } from 'react-router-dom';
import { ChevronRight, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { SUBSCRIPTION_STATUS, daysRemaining, formatDate } from '../lib/subscription.js';

// The drawer's hero subscription card — bold, dark, always high-contrast
// regardless of the app theme (mirrors the reference layout: a big
// number + "DAYS LEFT" on the left, a status pill + one line of copy in the
// middle, a circular arrow button on the right that opens /app/subscription).
// Every number is derived live from the ISO end date; nothing is hardcoded.
export function SubscriptionCard({ subscription, onNavigate }) {
  const navigate = useNavigate();
  const sub = subscription || { status: SUBSCRIPTION_STATUS.FREE_ACCESS, type: 'FREE_ACCESS' };

  function goToDetails() {
    onNavigate?.();
    navigate('/app/subscription');
  }

  let pill = 'Free access';
  let pillClass = 'bg-white/15 text-white';
  let copy = 'You have full access — no subscription needed.';
  let left = <Sparkles size={20} className="text-white/80" />;
  let arrowLabel = 'View subscription';

  if (sub.status === SUBSCRIPTION_STATUS.FREE_TRIAL) {
    const n = daysRemaining(sub.trialEndDate);
    pill = 'Free trial';
    pillClass = 'bg-accent-rose text-white';
    copy = 'Subscribe now to keep your access.';
    left = <BigCount value={n} />;
  } else if (sub.status === SUBSCRIPTION_STATUS.EXPIRED) {
    pill = 'Free trial';
    pillClass = 'bg-accent-rose text-white';
    copy = 'Your free trial has ended. Subscribe to continue.';
    left = <BigCount value={0} />;
    arrowLabel = 'Subscribe now';
  } else if (sub.status === SUBSCRIPTION_STATUS.ACTIVE) {
    pill = 'Active';
    pillClass = 'bg-emerald-500 text-white';
    copy = sub.subscriptionEndDate ? `Renews ${formatDate(sub.subscriptionEndDate)}.` : 'Your subscription is active.';
    left = <CheckCircle2 size={22} className="text-emerald-300" />;
  } else if (sub.status === SUBSCRIPTION_STATUS.CANCELLED) {
    pill = 'Cancelled';
    pillClass = 'bg-white/15 text-white';
    copy = sub.subscriptionEndDate ? `Access ends ${formatDate(sub.subscriptionEndDate)}.` : 'Your subscription was cancelled.';
    left = <XCircle size={22} className="text-white/70" />;
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-[#1d1636] to-[#100b1f] p-4 text-white shadow-lg">
      <div className="flex min-w-[52px] shrink-0 flex-col items-center justify-center text-center">{left}</div>
      <div className="min-w-0 flex-1">
        <span className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${pillClass}`}>
          {pill}
        </span>
        <p className="mt-1.5 text-sm font-medium leading-snug text-white/85">{copy}</p>
      </div>
      <button
        type="button"
        onClick={goToDetails}
        aria-label={arrowLabel}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-lime text-[#10152b] transition hover:brightness-110"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function BigCount({ value }) {
  return (
    <>
      <span className="font-display text-4xl font-bold leading-none">{value}</span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/55">
        {value === 1 ? 'Day left' : 'Days left'}
      </span>
    </>
  );
}

export default SubscriptionCard;
