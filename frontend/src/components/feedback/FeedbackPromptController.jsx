import { useCallback, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNewTransaction } from '../../context/NewTransactionContext.jsx';
import { useAssistant } from '../../context/AssistantContext.jsx';
import { isOnboardingCompleted } from '../../lib/onboarding.js';
import { api, feedbackApi } from '../../lib/api.js';
import { isFeedbackActive } from '../../lib/feedback.js';
import { useFeedbackPrompt } from '../../hooks/useFeedbackPrompt.js';
import { FeedbackPromptModal } from './FeedbackPromptModal.jsx';
import { FeedbackFormModal } from './FeedbackFormModal.jsx';

const SNOOZE_DAYS = 3;

// Mounted once inside AppLayout — owns the whole "should we auto-prompt for
// feedback right now" decision. Deliberately reuses the existing
// NewTransaction/Assistant open-state contexts to stay out of the way of
// payments, expense entry and AI conversations, rather than inventing a new
// global "a modal is open" registry for this alone.
export function FeedbackPromptController() {
  const { userId, isAuthed, user, setUser } = useAuth();
  const { isOpen: txOpen } = useNewTransaction();
  const { isOpen: assistantOpen } = useAssistant();
  const [showPrompt, setShowPrompt] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const snoozedUntil = user?.feedbackPromptSnoozedUntil ? new Date(user.feedbackPromptSnoozedUntil).getTime() : 0;
  const eligibleUser = isAuthed && !!user && !user.feedbackPromptDisabled && snoozedUntil < Date.now() && isOnboardingCompleted(userId);

  const checkAndShow = useCallback(async () => {
    try {
      const { rows } = await feedbackApi.list();
      if ((rows || []).some((t) => isFeedbackActive(t.status))) return; // already has an open conversation — don't pile on
    } catch {
      return; // best-effort — skip silently rather than risk nagging on a flaky request
    }
    setShowPrompt(true);
  }, []);

  useFeedbackPrompt({
    enabled: eligibleUser,
    blocked: txOpen || assistantOpen,
    onEligible: checkAndShow,
  });

  async function persistPromptPref(patch) {
    try {
      const fresh = await api.patch('/me', patch);
      if (fresh) setUser(fresh);
    } catch {
      // best-effort — worst case the prompt reappears next visit
    }
  }

  function giveFeedback() {
    setShowPrompt(false);
    setShowForm(true);
  }
  function remindLater() {
    setShowPrompt(false);
    persistPromptPref({ feedbackPromptSnoozedUntil: new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString() });
  }
  function dontAskAgain() {
    setShowPrompt(false);
    persistPromptPref({ feedbackPromptDisabled: true });
  }

  return (
    <>
      <FeedbackPromptModal open={showPrompt} onGiveFeedback={giveFeedback} onRemindLater={remindLater} onDontAskAgain={dontAskAgain} />
      <FeedbackFormModal open={showForm} onClose={() => setShowForm(false)} />
    </>
  );
}

export default FeedbackPromptController;
