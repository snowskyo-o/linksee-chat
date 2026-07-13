import { prisma } from "../../../../infra/db/prisma.mjs";
import { validateContent } from "./chat-domain.mjs";
import { buildFileSummary, cloneChatFilesToConversation } from "./chat-file-service.mjs";
import { createPersistedChatMessage, messageInclude } from "./chat-message-persistence.mjs";

export async function createForwardMessage({ req, res, targetConversationId, targetCtx }) {
  const sourceConversationId = typeof req.body?.sourceConversationId === "string" ? req.body.sourceConversationId.trim() : "";
  const sourceMessageId = typeof req.body?.sourceMessageId === "string" ? req.body.sourceMessageId.trim() : "";
  if (!sourceConversationId || !sourceMessageId) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "sourceConversationId 和 sourceMessageId 必填" });
    return null;
  }

  const sourceConversation = await prisma.chatConversation.findFirst({
    where: {
      id: BigInt(sourceConversationId),
      members: { some: { userId: req.userId } },
    },
    include: { members: true },
  }).catch(() => null);
  if (!sourceConversation) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "源会话不存在" });
    return null;
  }

  const sourceMessage = await prisma.chatMessage.findFirst({
    where: {
      id: BigInt(sourceMessageId),
      conversationId: sourceConversation.id,
      deletedAt: null,
    },
    include: messageInclude(),
  }).catch(() => null);
  if (!sourceMessage) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "源消息不存在" });
    return null;
  }

  const sourceFiles = Array.isArray(sourceMessage.files) ? sourceMessage.files : [];
  const nextFiles = sourceFiles.length
    ? await cloneChatFilesToConversation(sourceFiles, targetConversationId, sourceMessage.filesMeta || [])
    : [];
  const nextType = nextFiles.length ? "file" : "text";
  const nextContent = nextFiles.length ? buildFileSummary(nextFiles) : String(sourceMessage.content || "").trim();
  if (!nextFiles.length && !validateContent(nextContent, res)) return null;

  const created = await createPersistedChatMessage({
    conversationId: targetCtx.conversation.id,
    senderId: req.userId,
    content: nextContent,
    filesInput: nextFiles,
    mentions: [],
    replyToId: null,
  });

  return {
    created,
    forwardedFromConversationId: sourceConversationId,
    forwardedFromMessageId: sourceMessageId,
    type: nextType,
  };
}
