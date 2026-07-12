import { MessageSquareHeart } from 'lucide-react';
import { Modal, Button } from '../ui/index.js';

// The automatic "how's it going?" prompt — three exits, none of which force
// the user into the full form. Snooze/disable are persisted server-side by
// the caller (useFeedbackPrompt), not here.
export function FeedbackPromptModal({ open, onGiveFeedback, onRemindLater, onDontAskAgain }) {
  return (
    <Modal open={open} onClose={onRemindLater} size="sm">
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-500">
          <MessageSquareHeart size={22} />
        </span>
        <div>
          <p className="font-display text-lg font-semibold text-fg">How's it going so far?</p>
          <p className="mt-1 text-sm text-muted">Got a minute? Tell us what's working, what isn't, or what you'd like to see.</p>
        </div>
        <div className="mt-2 grid w-full gap-2">
          <Button onClick={onGiveFeedback} fullWidth>Give Feedback</Button>
          <Button variant="outline" onClick={onRemindLater} fullWidth>Remind Me Later</Button>
          <button type="button" onClick={onDontAskAgain} className="mt-1 text-xs text-subtle transition hover:text-muted">
            Don't ask again
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default FeedbackPromptModal;
