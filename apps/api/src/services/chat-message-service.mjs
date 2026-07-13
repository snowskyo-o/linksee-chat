import { buildFileSummary } from "./chat-file-service.mjs";
import { createForwardMessage } from "./chat-message-forwarding.mjs";
import { createPersistedChatMessage } from "./chat-message-persistence.mjs";
export { validateCreateMessagePayload } from "./chat-message-validation.mjs";

export async function createChatMessage({ conversationId, payload, userId }) {
  return createPersistedChatMessage({
    conversationId,
    senderId: userId,
    content: payload.messageType === "file" ? (payload.content || buildFileSummary(payload.filesInput)) : payload.content,
    filesInput: payload.filesInput,
    mentions: payload.mentions,
    replyToId: payload.replyToId,
  });
}
export { createForwardMessage };
