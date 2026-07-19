import { describe, it, expect } from 'vitest';
import {
  FEEDBACK_TYPES,
  DIRECT_MESSAGE_CATEGORY,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_STATUS_TONE,
  feedbackTypeLabel,
  isFeedbackActive,
} from '../feedback.js';

describe('feedbackTypeLabel', () => {
  it('returns the label for a known feedback type', () => {
    expect(feedbackTypeLabel('bug')).toBe('Bug Report');
  });

  it('returns the special label for the direct-message category', () => {
    expect(feedbackTypeLabel(DIRECT_MESSAGE_CATEGORY)).toBe('Message to Super Admin');
  });

  it('falls back to the raw value for an unknown type', () => {
    expect(feedbackTypeLabel('totally_unknown')).toBe('totally_unknown');
  });

  it('resolves a label for every entry in FEEDBACK_TYPES', () => {
    FEEDBACK_TYPES.forEach(({ value, label }) => {
      expect(feedbackTypeLabel(value)).toBe(label);
    });
  });
});

describe('isFeedbackActive', () => {
  it('is false for resolved tickets', () => {
    expect(isFeedbackActive('resolved')).toBe(false);
  });

  it('is false for closed tickets', () => {
    expect(isFeedbackActive('closed')).toBe(false);
  });

  it('is true for open tickets', () => {
    expect(isFeedbackActive('open')).toBe(true);
  });

  it('is true for in_progress tickets', () => {
    expect(isFeedbackActive('in_progress')).toBe(true);
  });

  it('is true for reopened tickets', () => {
    expect(isFeedbackActive('reopened')).toBe(true);
  });

  it('is true for an unrecognized status (only resolved/closed are excluded)', () => {
    expect(isFeedbackActive('some_future_status')).toBe(true);
  });
});

describe('status label/tone maps', () => {
  it('has a label and tone for every status referenced by FEEDBACK_STATUS_LABEL', () => {
    Object.keys(FEEDBACK_STATUS_LABEL).forEach((status) => {
      expect(FEEDBACK_STATUS_TONE[status]).toBeDefined();
    });
  });
});
