// FinancialAssistantProvider contract: { answer({ message, intentId, args }) }
// returning a structured response (see handlers.js for the shape). The rest
// of the app (AssistantContext, chat UI) only ever talks to this interface —
// swapping in a real LLM later (e.g. a provider that calls a new backend
// endpoint) means adding a new module with the same `answer` signature and
// changing the single line below. No UI or state-management code would change.
import { localProvider } from './localProvider.js';

export function getAssistantProvider() {
  return localProvider;
}
