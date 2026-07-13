import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import {
  loadConversationMessage,
  loadMessagesForConversation,
  removeChatMessageFiles,
  serializeMessage,
} from "./chat-route-helpers.mjs";
import {
  requireConversation,
  validateContent,
} from "../services/chat-domain.mjs";
import {
  createChatMessage,
  createForwardMessage,
  validateCreateMessagePayload,
} from "../services/chat-message-service.mjs";

export function createChatMessageRouter(emitConversationEvent) {
  const router = Router();

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

  router.patch("/conversations/:conversationId/messages/:messageId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;

    const message = await loadConversationMessage(res, ctx.conversation.id, req.params.messageId);
    if (!message || message.deletedAt) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "消息不存在" });
    }
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能编辑自己的消息" });
    }
    if (Array.isArray(message.files) && message.files.length > 0) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "只有文本消息可以编辑" });
    }

    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const mentions = Array.isArray(req.body?.mentions)
      ? req.body.mentions.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
      : await parseMentions(req.params.conversationId, content);
    if (!validateContent(content, res)) return;

    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        content,
        mentions,
        editedAt: new Date(),
      },
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
    if (!message || message.deletedAt) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "消息不存在" });
    }
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能撤回自己的消息" });
    }

    await removeChatMessageFiles(message);
    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        content: null,
        files: null,
        mentions: null,
        deletedAt: new Date(),
      },
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
    if (!message || message.deletedAt) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "消息不存在" });
    }
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能删除自己的消息" });
    }

    await removeChatMessageFiles(message);
    const updated = await prisma.chatMessage.update({
      where: { id: message.id },
      data: {
        content: null,
        files: null,
        mentions: null,
        deletedAt: new Date(),
      },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });

    emitConversationEvent(ctx.conversation.id, "conversation.message.deleted", { messageId: updated.id.toString() });
    return res.json({ ok: true, data: serializeMessage(updated) });
  });

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
      where: {
        conversationId_userId: {
          conversationId: ctx.conversation.id,
          userId: req.userId,
        },
      },
      update: {
        lastMessageId: message.id,
        lastReadAt: new Date(),
      },
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

  return router;
}
