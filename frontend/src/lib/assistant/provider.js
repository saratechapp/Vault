// FinancialAssistantProvider contract: { answer({ message, intentId, args }) }
// returning a structured response (see handlers.js for the shape). The rest
// of the app (AssistantContext, chat UI) only ever talks to this interface —
// swapping providers means adding a new module with the same `answer`
// signature and changing the single line below. No UI or state-management
// code needs to change.
//
// Now backed by backendProvider (backend/services/assistantEngine.js) rather
// than localProvider — same rule-based logic, moved server-side so the
// mobile app shares the identical engine and every exchange is persisted to
// a real, synced conversation instead of living only in this tab's React
// state. localProvider is kept in the codebase (still fully functional,
// still covered by its own tests) as an offline/no-backend fallback, not
// deleted.
import { backendProvider } from './backendProvider.js';

export function getAssistantProvider() {
  return backendProvider;
}
