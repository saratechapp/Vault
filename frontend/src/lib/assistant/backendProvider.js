// FinancialAssistantProvider backed by the server-side assistant engine
// (backend/services/assistantEngine.js) instead of localProvider's
// client-only intent matching — same rule-based logic, just moved server-side
// so mobile shares the exact same engine and every exchange is persisted to
// a real conversation (see 0018_ai_conversations.sql), instead of living
// only in this tab's React state.
//
// Conversation creation is lazy (on first send, not on mount) so opening the
// assistant panel without sending anything doesn't leave an empty
// conversation row behind. This module-level singleton resets on a full page
// reload — restoring/continuing a previous conversation on mount is a
// deliberate Phase 1 scope cut (see the Ask AI plan's Section A5); the panel
// still behaves as "fresh session each time you open it," just now backed by
// a real, queryable, synced conversation instead of nothing at all.
import { assistantApi } from '../api.js';

let activeConversationId = null;

async function ensureConversation() {
  if (activeConversationId) return activeConversationId;
  const conversation = await assistantApi.createConversation();
  activeConversationId = conversation.id;
  return activeConversationId;
}

async function answer({ message, intentId, args }) {
  const conversationId = await ensureConversation();
  const assistantMessage = await assistantApi.sendMessage(conversationId, { message, intentId, args });
  return assistantMessage.metadata;
}

export const backendProvider = { answer };
