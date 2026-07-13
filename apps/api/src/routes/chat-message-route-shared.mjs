import { prisma } from "../../../../infra/db/prisma.mjs";
import { loadConversationMessage, loadMessagesForConversation, removeChatMessageFiles, serializeMessage } from "./chat-route-helpers.mjs";
import { parseMentions, requireConversation, validateContent } from "../services/chat-domain.mjs";

export {
  loadConversationMessage,
  loadMessagesForConversation,
  parseMentions,
  prisma,
  removeChatMessageFiles,
  requireConversation,
  serializeMessage,
  validateContent,
};

export function messageNotFound(res) {
  return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "消息不存在" });
}
