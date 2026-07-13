import { prisma, requireConversation } from "./chat-message-route-shared.mjs";

export function registerChatMessageReadRoutes(router, emitConversationEvent) {
  router.post("/conversations/:conversationId/read", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const messageId = typeof req.body?.messageId === "string" ? req.body.messageId : "";
    const message = await prisma.chatMessage.findFirst({
      where: { id: BigInt(messageId), conversationId: ctx.conversation.id },
      select: { id: true },
    }).catch(() => null);
    if (!message) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "messageId 无效" });
    }
    await prisma.chatConversationRead.upsert({
      where: { conversationId_userId: { conversationId: ctx.conversation.id, userId: req.userId } },
      update: { lastMessageId: message.id, lastReadAt: new Date() },
      create: {
        conversationId: ctx.conversation.id,
        userId: req.userId,
        lastMessageId: message.id,
        lastReadAt: new Date(),
      },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.read.updated", { userId: req.userId, messageId });
    return res.json({ ok: true });
  });
}
