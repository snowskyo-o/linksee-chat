import {
  loadMessagesForConversation,
  prisma,
  requireConversation,
  serializeMessage,
} from "./chat-message-route-shared.mjs";

export function registerChatMessageQueryRoutes(router) {
  router.get("/conversations/:conversationId/messages", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const beforeId = typeof req.query.beforeId === "string" ? req.query.beforeId : "";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50) || 50));
    const messages = await loadMessagesForConversation(req.params.conversationId, beforeId, limit);
    return res.json({ ok: true, data: messages.map(serializeMessage) });
  });

  router.get("/conversations/:conversationId/messages/search", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const keyword = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (!keyword) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "q 必填" });
    }
    const rows = await prisma.chatMessage.findMany({
      where: {
        conversationId: ctx.conversation.id,
        deletedAt: null,
        content: { contains: keyword },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });
    return res.json({ ok: true, data: rows.map(serializeMessage) });
  });
}
