import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAccountsGate } from '../../context/AccountsGateContext.jsx';
import { isOnboardingCompleted, markOnboardingCompleted, promptCreateAccountOnNextVisit } from '../../lib/onboarding.js';
import { TOUR_STEPS } from './tourSteps.js';
import { useTourTargets } from './useTourTargets.js';
import { TourSpotlight } from './TourSpotlight.jsx';
import { TourTooltip } from './TourTooltip.jsx';

// Bundles spotlight + tooltip as a single AnimatePresence child (keyed by
// step id) so the whole visual — dark cutout, glow ring(s) and tooltip —
// fades/slides together as one unit whenever the step changes or the tour
// closes, rather than each piece animating independently.
function TourStepContent({ step, stepIndex, total, rects, onNext, onPrev, onSkip }) {
  return (
    <>
      <TourSpotlight rects={rects} />
      <TourTooltip
        step={step}
        stepIndex={stepIndex}
        total={total}
        rects={rects}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
      />
    </>
  );
}

// Runs entirely on top of the Dashboard (every step's target lives there —
// see tourSteps.js) for a first-time user who hasn't completed or skipped it
// yet. `active` is passed in by AppLayout as "are we currently on the
// dashboard route" — if the user navigates away mid-tour the overlay simply
// hides (state is preserved) and picks back up when they return.
export function ProductTour({ active }) {
  const { user, ready } = useAuth();
  const { hasAccounts } = useAccountsGate();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!ready || !active || !user?.id) return;
    if (!isOnboardingCompleted(user.id)) setVisible(true);
  }, [ready, active, user?.id]);

  const running = visible && active;
  const step = TOUR_STEPS[stepIndex];
  const { rects, ready: rectsReady } = useTourTargets(step.targets, running);

  // Skip and Finish both end here — send a user who still has zero accounts
  // straight to Accounts with a prompt to create one, since that's the one
  // hard requirement the rest of the app is gated on. Someone who already
  // created an account mid-tour (the CTA stays clickable during step 2)
  // just returns to the dashboard as normal.
  function finish() {
    if (user?.id) markOnboardingCompleted(user.id);
    setVisible(false);
    if (!hasAccounts) {
      promptCreateAccountOnNextVisit();
      navigate('/app/accounts');
    }
  }

  function handleNext() {
    if (stepIndex >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }

  function handlePrev() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const showContent = running && rectsReady;

  return (
    <AnimatePresence>
      {showContent && (
        <TourStepContent
          key={step.id}
          step={step}
          stepIndex={stepIndex}
          total={TOUR_STEPS.length}
          rects={rects}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={finish}
        />
      )}
    </AnimatePresence>
  );
}

export default ProductTour;
