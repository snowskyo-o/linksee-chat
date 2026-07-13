import {
  loadConversationMessage,
  messageNotFound,
  parseMentions,
  prisma,
  removeChatMessageFiles,
  requireConversation,
  serializeMessage,
  validateContent,
} from "./chat-message-route-shared.mjs";

function parseMentionIds(input) {
  return Array.isArray(input)
    ? input.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
    : null;
}

export function registerChatMessageStateRoutes(router, emitConversationEvent) {
  router.patch("/conversations/:conversationId/messages/:messageId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const message = await loadConversationMessage(res, ctx.conversation.id, req.params.messageId);
    if (!message || message.deletedAt) return messageNotFound(res);
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能编辑自己的消息" });
    }
    if (Array.isArray(message.files) && message.files.length > 0) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "只有文本消息可以编辑" });
    }

    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const mentions = parseMentionIds(req.body?.mentions) || await parseMentions(req.params.conversationId, content);
    if (!validateContent(content, res)) return;
    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: { content, mentions, editedAt: new Date() },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.message.updated", { messageId: updated.id.toString() });
    return res.json({ ok: true, data: serializeMessage(updated) });
  });

  router.post("/conversations/:conversationId/messages/:messageId/recall", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const message = await loadConversationMessage(res, ctx.conversation.id, req.params.messageId);
    if (!message || message.deletedAt) return messageNotFound(res);
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能撤回自己的消息" });
    }
    await removeChatMessageFiles(message);
    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: { content: null, files: null, mentions: null, deletedAt: new Date() },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.message.deleted", { messageId: updated.id.toString() });
    return res.json({ ok: true, data: serializeMessage(updated) });
  });

  router.delete("/conversations/:conversationId/messages/:messageId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const message = await loadConversationMessage(res, ctx.conversation.id, req.params.messageId);
    if (!message || message.deletedAt) return messageNotFound(res);
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能删除自己的消息" });
    }
    await removeChatMessageFiles(message);
    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: { content: null, files: null, mentions: null, deletedAt: new Date() },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.message.deleted", { messageId: updated.id.toString() });
    return res.json({ ok: true, data: serializeMessage(updated) });
  });
}
