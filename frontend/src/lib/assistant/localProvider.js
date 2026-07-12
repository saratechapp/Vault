// Concrete "answer engine" behind the FinancialAssistantProvider interface
// (see provider.js) — resolves a question (typed text or a follow-up chip's
// explicit intent) to a handler in handlers.js and returns its structured
// response. Everything here is synchronous logic + calls to already-
// authenticated app endpoints; no network calls to any external AI service.
import { HANDLERS, matchIntent, SUGGESTED_QUESTIONS } from './intents.js';

const FALLBACK_RESPONSE = {
  text: "I'm not sure how to answer that yet. Try one of these:",
  followUps: SUGGESTED_QUESTIONS.slice(0, 4).map((q) => ({ label: q.label, message: q.label })),
};

async function answer({ message, intentId, args }) {
  const resolved = intentId ? { id: intentId, args: args || {} } : matchIntent(message);
  if (!resolved || !HANDLERS[resolved.id]) {
    return FALLBACK_RESPONSE;
  }
  try {
    return await HANDLERS[resolved.id](resolved.args);
  } catch {
    return { text: "Something went wrong pulling that up — please try again in a moment." };
  }
}

export const localProvider = { answer };
