// Shared feedback constants — kept in one place so the popup form, the My
// Feedback page, and Settings' entry point can't drift out of sync with each
// other or with the backend's FEEDBACK_CATEGORIES (backend/server.js).
export const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'performance', label: 'Performance Issue' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'ai_assistant', label: 'AI Assistant' },
  { value: 'voice_entry', label: 'Voice Entry' },
  { value: 'ui_ux', label: 'UI/UX Improvement' },
  { value: 'sync_issue', label: 'Sync Issue' },
  { value: 'security', label: 'Security Concern' },
  { value: 'billing', label: 'Billing Issue' },
  { value: 'other', label: 'Other' },
];

// Not shown in the regular feedback-type picker — reached via its own
// "Message Super Admin" entry point instead, but shares the same table/API.
export const DIRECT_MESSAGE_CATEGORY = 'general_message';

export const FEEDBACK_STATUS_LABEL = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_for_user: 'Waiting for You',
  testing: 'Testing',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

export const FEEDBACK_STATUS_TONE = {
  open: 'info',
  assigned: 'info',
  in_progress: 'warning',
  waiting_for_user: 'warning',
  testing: 'info',
  resolved: 'success',
  closed: 'neutral',
  reopened: 'danger',
};

export function feedbackTypeLabel(value) {
  if (value === DIRECT_MESSAGE_CATEGORY) return 'Message to Super Admin';
  return FEEDBACK_TYPES.find((t) => t.value === value)?.label || value;
}

// A ticket still needs the user's attention if it isn't fully wrapped up —
// used to gate the auto-popup ("no active feedback request open") and to
// badge the My Feedback list.
export function isFeedbackActive(status) {
  return status !== 'resolved' && status !== 'closed';
}
