import crypto from "node:crypto";
import {
  createChatMessage,
  createForwardMessage,
  validateCreateMessagePayload,
} from "../services/chat-message-service.mjs";
import {
  prisma,
  requireConversation,
  serializeMessage,
  validateContent,
} from "./chat-message-route-shared.mjs";

export function registerChatMessageCreateRoutes(router, emitConversationEvent) {
  router.post("/conversations/:conversationId/messages", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const payload = await validateCreateMessagePayload({
      conversationId: req.params.conversationId,
      ctx,
      req,
      res,
    });
    if (!payload) return;
    const created = await createChatMessage({
      conversationId: ctx.conversation.id,
      payload,
      userId: req.userId,
    });
    emitConversationEvent(ctx.conversation.id, "conversation.message.created", { messageId: created.id.toString() });
    return res.status(201).json({ ok: true, data: serializeMessage(created) });
  });

  router.post("/conversations/:conversationId/messages/forward", async (req, res) => {
    const targetCtx = await requireConversation(req, res);
    if (!targetCtx) return;
    const forwardResult = await createForwardMessage({
      req,
      res,
      targetConversationId: req.params.conversationId,
      targetCtx,
    });
    if (!forwardResult) return;
    const { created, forwardedFromConversationId, forwardedFromMessageId, type } = forwardResult;
    emitConversationEvent(targetCtx.conversation.id, "conversation.message.created", {
      messageId: created.id.toString(),
      forwardedFromConversationId,
      forwardedFromMessageId,
      type,
    });
    return res.status(201).json({ ok: true, data: serializeMessage(created) });
  });

  router.post("/conversations/:conversationId/announcements", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    if (!validateContent(content, res)) return;
    const created = await prisma.chatMessage.create({
      data: {
        conversationId: ctx.conversation.id,
        senderId: req.userId,
        content,
        files: { type: "announcement" },
        eventId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
      },
      include: {
        sender: { include: { profile: true } },
        filesMeta: true,
      },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.message.created", { messageId: created.id.toString() });
    return res.status(201).json({ ok: true, data: serializeMessage(created) });
  });
}
