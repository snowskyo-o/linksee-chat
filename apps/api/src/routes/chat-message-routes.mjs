import crypto from "node:crypto";
import { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import {
  loadConversationMessage,
  loadMessagesForConversation,
  removeChatMessageFiles,
  serializeMessage,
} from "./chat-route-helpers.mjs";
import {
  parseMentions,
  requireConversation,
  validateContent,
} from "../services/chat-domain.mjs";
import {
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_RETENTION_MS,
  buildFileSummary,
  cloneChatFilesToConversation,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInConversation,
  normalizeChatFiles,
} from "../services/chat-file-service.mjs";

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

    const messageType = typeof req.body?.type === "string" ? req.body.type : "text";
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const replyToId = typeof req.body?.replyToId === "string" ? req.body.replyToId : null;
    const filesInput = normalizeChatFiles(req.body?.files);
    const mentions = Array.isArray(req.body?.mentions)
      ? req.body.mentions.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
      : await parseMentions(req.params.conversationId, content);
    if (messageType !== "text" && messageType !== "file") {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "type 必须是 text 或 file" });
    }
    if (messageType === "text") {
      if (!validateContent(content, res)) return;
      if (filesInput.length > 0) {
        return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文本消息不能附带 files" });
      }
    }
    if (messageType === "file" && filesInput.length === 0) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件消息必须携带 files" });
    }

    if (replyToId) {
      const replyMessage = await prisma.chatMessage.findFirst({
        where: { id: BigInt(replyToId), conversationId: ctx.conversation.id },
        select: { id: true },
      }).catch(() => null);
      if (!replyMessage) {
        return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "replyToId 无效" });
      }
    }
    if (mentions.length > 20) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "mentions 不能超过 20 个" });
    }
    for (const file of filesInput) {
      if (!ensureChatFileSize(file.size)) {
        return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `文件大小不能超过 ${CHAT_FILE_MAX_BYTES} 字节` });
      }
      if (!isAllowedChatMimeType(file.mimeType)) {
        return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `不支持的类型: ${file.mimeType}` });
      }
      if (!isObjectKeyInConversation(file.objectKey, ctx.conversation.id.toString())) {
        return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件 objectKey 与当前会话不匹配" });
      }
    }
    const participantIds = new Set(ctx.conversation.members.map((member) => member.userId));
    const invalidMentions = mentions.filter((userId) => !participantIds.has(userId));
    if (invalidMentions.length > 0) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `mentions 必须在当前会话内: ${invalidMentions.join(", ")}` });
    }

    const created = await prisma.chatMessage.create({
      data: {
        conversationId: ctx.conversation.id,
        senderId: req.userId,
        content: messageType === "file" ? (content || buildFileSummary(filesInput)) : content,
        files: filesInput.length > 0 ? filesInput : null,
        mentions,
        replyToId: replyToId ? BigInt(replyToId) : null,
        eventId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
        filesMeta: filesInput.length > 0
          ? {
              create: filesInput.map((file) => ({
                objectKey: file.objectKey,
                name: file.name,
                size: BigInt(file.size),
                mimeType: file.mimeType,
                uploadedAt: new Date(file.uploadedAt),
                expiresAt: new Date(Date.now() + CHAT_FILE_RETENTION_MS),
              })),
            }
          : undefined,
      },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });

    emitConversationEvent(ctx.conversation.id, "conversation.message.created", { messageId: created.id.toString() });
    return res.status(201).json({ ok: true, data: serializeMessage(created) });
  });

  router.post("/conversations/:conversationId/messages/forward", async (req, res) => {
    const targetCtx = await requireConversation(req, res);
    if (!targetCtx) return;

    const sourceConversationId = typeof req.body?.sourceConversationId === "string" ? req.body.sourceConversationId.trim() : "";
    const sourceMessageId = typeof req.body?.sourceMessageId === "string" ? req.body.sourceMessageId.trim() : "";
    if (!sourceConversationId || !sourceMessageId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "sourceConversationId 和 sourceMessageId 必填" });
    }

    const sourceConversation = await prisma.chatConversation.findFirst({
      where: {
        id: BigInt(sourceConversationId),
        members: { some: { userId: req.userId } },
      },
      include: { members: true },
    }).catch(() => null);
    if (!sourceConversation) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "源会话不存在" });
    }

    const sourceMessage = await prisma.chatMessage.findFirst({
      where: {
        id: BigInt(sourceMessageId),
        conversationId: sourceConversation.id,
        deletedAt: null,
      },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    }).catch(() => null);
    if (!sourceMessage) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "源消息不存在" });
    }

    const sourceFiles = Array.isArray(sourceMessage.files) ? sourceMessage.files : [];
    const nextFiles = sourceFiles.length
      ? await cloneChatFilesToConversation(sourceFiles, req.params.conversationId, sourceMessage.filesMeta || [])
      : [];
    const nextType = nextFiles.length ? "file" : "text";
    const nextContent = nextFiles.length
      ? buildFileSummary(nextFiles)
      : String(sourceMessage.content || "").trim();
    if (!nextFiles.length && !validateContent(nextContent, res)) return;

    const created = await prisma.chatMessage.create({
      data: {
        conversationId: targetCtx.conversation.id,
        senderId: req.userId,
        content: nextContent,
        files: nextFiles.length ? nextFiles : null,
        mentions: [],
        replyToId: null,
        eventId: crypto.randomUUID(),
        traceId: crypto.randomUUID(),
        filesMeta: nextFiles.length
          ? {
              create: nextFiles.map((file) => ({
                objectKey: file.objectKey,
                name: file.name,
                size: BigInt(file.size),
                mimeType: file.mimeType,
                uploadedAt: new Date(file.uploadedAt),
                expiresAt: new Date(file.expiresAt || Date.now() + CHAT_FILE_RETENTION_MS),
              })),
            }
          : undefined,
      },
      include: {
        sender: { include: { profile: true } },
        replyTo: { include: { filesMeta: true } },
        filesMeta: true,
      },
    });

    emitConversationEvent(targetCtx.conversation.id, "conversation.message.created", {
      messageId: created.id.toString(),
      forwardedFromConversationId: sourceConversationId,
      forwardedFromMessageId: sourceMessageId,
      type: nextType,
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
