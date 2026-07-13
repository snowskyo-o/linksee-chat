import { createConversationForRequest } from "../services/chat-domain.mjs";
import {
  buildConversationResponse,
  prisma,
  requireConversation,
  sanitizeUser,
} from "./chat-conversation-route-shared.mjs";

export function registerChatConversationRoutes(router) {
  router.get("/conversations", async (req, res) => {
    const rows = await prisma.chatConversation.findMany({
      where: {
        members: { some: { userId: req.userId } },
        states: { none: { userId: req.userId, hiddenAt: { not: null } } },
      },
      orderBy: { updatedAt: "desc" },
      include: { members: { include: { user: { include: { profile: true } } } } },
    });
    const data = await Promise.all(rows.map((conversation) => buildConversationResponse(req.userId, conversation)));
    return res.json({ ok: true, data });
  });

  router.post("/conversations", async (req, res) => {
    const created = await createConversationForRequest(req.userId, req.body, res);
    if (!created) return;
    await prisma.chatConversationState.delete({
      where: { conversationId_userId: { conversationId: created.conversation.id, userId: req.userId } },
    }).catch(() => {});
    return res.status(created.statusCode).json({
      ok: true,
      data: await buildConversationResponse(req.userId, created.conversation),
    });
  });

  router.delete("/conversations/:conversationId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    await prisma.chatConversationState.upsert({
      where: { conversationId_userId: { conversationId: ctx.conversation.id, userId: req.userId } },
      update: { hiddenAt: new Date() },
      create: { conversationId: ctx.conversation.id, userId: req.userId, hiddenAt: new Date() },
    });
    return res.json({ ok: true });
  });

  router.post("/conversations/:conversationId/pin", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    await prisma.chatConversationPin.upsert({
      where: { conversationId_userId: { conversationId: ctx.conversation.id, userId: req.userId } },
      update: { pinnedAt: new Date() },
      create: { conversationId: ctx.conversation.id, userId: req.userId },
    });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, ctx.conversation) });
  });

  router.delete("/conversations/:conversationId/pin", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    await prisma.chatConversationPin.delete({
      where: { conversationId_userId: { conversationId: ctx.conversation.id, userId: req.userId } },
    }).catch(() => {});
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, ctx.conversation) });
  });

  router.get("/conversations/:conversationId/participants", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    const participants = ctx.conversation.members.map((member) => sanitizeUser(member.user)).filter(Boolean);
    return res.json({ ok: true, data: participants });
  });
}
