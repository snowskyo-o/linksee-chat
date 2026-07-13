import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { createChatFileRouter } from "./chat-file-routes.mjs";
import { createChatFriendRouter } from "./chat-friend-routes.mjs";
import { createChatMessageRouter } from "./chat-message-routes.mjs";
import {
  resolveConversationById,
  sanitizeUser,
} from "../services/chat-store.mjs";
import {
  clearConversationMemberState,
} from "./chat-route-helpers.mjs";
import {
  buildConversationResponse,
  createConversationForRequest,
  requireConversation,
} from "../services/chat-domain.mjs";

export function createChatRouter(emitConversationEvent) {
  const router = Router();
  router.use(createChatFriendRouter());
  router.use(createChatFileRouter());
  router.use(createChatMessageRouter(emitConversationEvent));

  router.get("/conversations", async (req, res) => {
    const rows = await prisma.chatConversation.findMany({
      where: {
        members: { some: { userId: req.userId } },
        states: {
          none: {
            userId: req.userId,
            hiddenAt: { not: null },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      include: {
        members: {
          include: { user: { include: { profile: true } } },
        },
      },
    });

    const data = await Promise.all(rows.map((conversation) => buildConversationResponse(req.userId, conversation)));
    return res.json({ ok: true, data });
  });

  router.post("/conversations", async (req, res) => {
    const created = await createConversationForRequest(req.userId, req.body, res);
    if (!created) return;
    await prisma.chatConversationState.delete({
      where: {
        conversationId_userId: {
          conversationId: created.conversation.id,
          userId: req.userId,
        },
      },
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
      where: {
        conversationId_userId: {
          conversationId: ctx.conversation.id,
          userId: req.userId,
        },
      },
      update: { hiddenAt: new Date() },
      create: {
        conversationId: ctx.conversation.id,
        userId: req.userId,
        hiddenAt: new Date(),
      },
    });

    return res.json({ ok: true });
  });

  router.post("/conversations/:conversationId/pin", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;

    await prisma.chatConversationPin.upsert({
      where: {
        conversationId_userId: {
          conversationId: ctx.conversation.id,
          userId: req.userId,
        },
      },
      update: { pinnedAt: new Date() },
      create: {
        conversationId: ctx.conversation.id,
        userId: req.userId,
      },
    });

    return res.json({ ok: true, data: await buildConversationResponse(req.userId, ctx.conversation) });
  });

  router.delete("/conversations/:conversationId/pin", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;

    await prisma.chatConversationPin.delete({
      where: {
        conversationId_userId: {
          conversationId: ctx.conversation.id,
          userId: req.userId,
        },
      },
    }).catch(() => {});

    return res.json({ ok: true, data: await buildConversationResponse(req.userId, ctx.conversation) });
  });

  router.get("/conversations/:conversationId/participants", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;

    const participants = ctx.conversation.members
      .map((member) => sanitizeUser(member.user))
      .filter(Boolean);
    return res.json({ ok: true, data: participants });
  });

  router.patch("/conversations/:conversationId/group", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    if (ctx.conversation.kind !== "group") {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "当前会话不是群聊" });
    }
    if (ctx.conversation.createdBy !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只有群主可以修改群名称" });
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "title 必填" });
    }
    if (title.length > 60) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "title 不能超过 60 个字符" });
    }
    await prisma.chatConversation.update({
      where: { id: ctx.conversation.id },
      data: { title },
    });
    const updatedConversation = await resolveConversationById(req.params.conversationId);
    emitConversationEvent(ctx.conversation.id, "conversation.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, updatedConversation) });
  });

  router.post("/conversations/:conversationId/members", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    if (ctx.conversation.kind !== "group") {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "当前会话不是群聊" });
    }
    const participantIds = Array.isArray(req.body?.participantIds)
      ? req.body.participantIds.filter((value) => typeof value === "string").map((value) => value.trim()).filter(Boolean)
      : [];
    const existingIds = new Set(ctx.conversation.members.map((member) => member.userId));
    const nextParticipantIds = Array.from(new Set(participantIds)).filter((userId) => !existingIds.has(userId));
    if (!nextParticipantIds.length) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "没有可新增的群成员" });
    }
    const users = await prisma.user.findMany({
      where: { id: { in: nextParticipantIds }, isActive: true },
      select: { id: true },
    });
    const foundIds = new Set(users.map((user) => user.id));
    const missingIds = nextParticipantIds.filter((userId) => !foundIds.has(userId));
    if (missingIds.length) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `用户不存在: ${missingIds.join(", ")}` });
    }
    await prisma.chatConversationMember.createMany({
      data: nextParticipantIds.map((userId) => ({ conversationId: ctx.conversation.id, userId })),
      skipDuplicates: true,
    });
    await prisma.chatConversation.update({
      where: { id: ctx.conversation.id },
      data: { updatedAt: new Date() },
    });
    const updatedConversation = await resolveConversationById(req.params.conversationId);
    emitConversationEvent(ctx.conversation.id, "conversation.members.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, updatedConversation) });
  });

  router.post("/conversations/:conversationId/leave", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    if (ctx.conversation.kind !== "group") {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "当前会话不是群聊" });
    }
    const remainingMembers = ctx.conversation.members.filter((member) => member.userId !== req.userId);
    if (!remainingMembers.length) {
      await prisma.chatConversation.delete({ where: { id: ctx.conversation.id } });
      return res.json({ ok: true, data: { conversationId: req.params.conversationId, removed: true } });
    }
    const nextOwnerId = ctx.conversation.createdBy === req.userId ? remainingMembers[0]?.userId || "" : ctx.conversation.createdBy;
    await clearConversationMemberState(ctx.conversation.id, req.userId);
    await prisma.chatConversation.update({
      where: { id: ctx.conversation.id },
      data: {
        createdBy: nextOwnerId || null,
        updatedAt: new Date(),
      },
    });
    emitConversationEvent(ctx.conversation.id, "conversation.members.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: { conversationId: req.params.conversationId, removed: true, nextOwnerId } });
  });

  router.delete("/conversations/:conversationId/members/:memberUserId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;
    if (ctx.conversation.kind !== "group") {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "当前会话不是群聊" });
    }
    if (ctx.conversation.createdBy !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只有群主可以移除成员" });
    }
    const memberUserId = String(req.params.memberUserId || "").trim();
    if (!memberUserId || memberUserId === req.userId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "不能移除群主本人" });
    }
    const targetMember = ctx.conversation.members.find((member) => member.userId === memberUserId);
    if (!targetMember) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "群成员不存在" });
    }
    await clearConversationMemberState(ctx.conversation.id, memberUserId);
    await prisma.chatConversation.update({
      where: { id: ctx.conversation.id },
      data: { updatedAt: new Date() },
    });
    const updatedConversation = await resolveConversationById(req.params.conversationId);
    emitConversationEvent(ctx.conversation.id, "conversation.members.updated", { conversationId: req.params.conversationId });
    return res.json({ ok: true, data: await buildConversationResponse(req.userId, updatedConversation) });
  });

  return router;
}
