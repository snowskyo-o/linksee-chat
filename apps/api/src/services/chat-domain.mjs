import {
  getConversationParticipants,
  resolveConversationById,
} from "./chat-store.mjs";
export { createConversationForRequest } from "./chat-conversation-create.mjs";
export { buildConversationResponse } from "./chat-conversation-response.mjs";

export async function parseMentions(conversationId, content) {
  const participants = await getConversationParticipants(conversationId);
  const names = new Map(participants.map((user) => [String(user.profile.realName || ""), user.id]));
  const found = new Set();

  (String(content || "").match(/@([A-Za-z0-9_\-\u4e00-\u9fa5]+)/g) || []).forEach((token) => {
    const raw = token.slice(1);
    if (names.has(raw)) found.add(names.get(raw));
  });

  return Array.from(found);
}

export function validateContent(content, res) {
  if (!content) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "content 必填" });
    return false;
  }
  if (content.length > 5000) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "content 不能超过 5000 个字符" });
    return false;
  }
  return true;
}

export async function requireConversation(req, res) {
  const conversation = await resolveConversationById(req.params.conversationId);
  if (!conversation) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "会话不存在" });
    return null;
  }

  const member = conversation.members.find((item) => item.userId === req.userId);
  if (!member) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "会话不存在" });
    return null;
  }

  return { conversation };
}
