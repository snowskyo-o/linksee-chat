import crypto from "node:crypto";
import express, { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import {
  buildConversationTitle,
  buildMessageType,
  findContacts,
  sanitizeUser,
} from "../services/chat-store.mjs";
import {
  buildConversationResponse,
  createConversationForRequest,
  parseMentions,
  requireConversation,
  validateContent,
} from "../services/chat-domain.mjs";
import {
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_RETENTION_MS,
  buildChatObjectKey,
  buildFileSummary,
  cleanupExpiredChatFiles,
  enrichChatFilesForResponse,
  ensureChatFileSize,
  isObjectKeyInConversation,
  isAllowedChatMimeType,
  normalizeChatFiles,
  presignChatDownload,
  presignChatUpload,
} from "../services/chat-file-service.mjs";

function serializeMessage(message) {
  const files = enrichChatFilesForResponse(message.files, message.filesMeta || []);
  return {
    id: message.id.toString(),
    conversationId: message.conversationId.toString(),
    senderId: message.senderId,
    sender: sanitizeUser(message.sender),
    content: message.content || "",
    type: buildMessageType(files.length ? files : message.files, message.content),
    files,
    mentions: Array.isArray(message.mentions) ? message.mentions : [],
    mentionNames: Array.isArray(message.mentions)
      ? (message.mentionsUsers || []).map((user) => user.profile?.realName || user.id)
      : [],
    replyToId: message.replyToId ? message.replyToId.toString() : null,
    replyTo: message.replyTo
      ? {
          id: message.replyTo.id.toString(),
          senderId: message.replyTo.senderId,
          content: message.replyTo.content || "",
          type: buildMessageType(message.replyTo.files, message.replyTo.content),
          files: enrichChatFilesForResponse(message.replyTo.files, message.replyTo.filesMeta || []),
        }
      : null,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt ? message.editedAt.toISOString() : null,
    deletedAt: message.deletedAt ? message.deletedAt.toISOString() : null,
  };
}

async function loadMessagesForConversation(conversationId, beforeId = "", limit = 50) {
  const rows = await prisma.chatMessage.findMany({
    where: {
      conversationId: BigInt(conversationId),
      ...(beforeId ? { id: { lt: BigInt(beforeId) } } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(100, Math.max(1, Number(limit) || 50)),
    include: {
      sender: { include: { profile: true } },
      replyTo: { include: { filesMeta: true } },
      filesMeta: true,
    },
  });
  return rows.reverse();
}

export function createChatRouter(emitConversationEvent) {
  const router = Router();

  router.get("/contacts", async (req, res) => {
    const contacts = await findContacts(req.userId);
    return res.json({ ok: true, data: contacts });
  });

  router.get("/chat/files/download", async (req, res) => {
    const objectKey = typeof req.query.objectKey === "string" ? req.query.objectKey : "";
    if (!objectKey) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "objectKey 必填" });
    }

    const file = await prisma.chatFile.findUnique({
      where: { objectKey },
      include: {
        message: {
          include: {
            conversation: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });
    if (!file) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "附件不存在" });
    }
    if (file.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({ ok: false, code: "FILE_EXPIRED", message: "附件已过期" });
    }
    if (!file.message.conversation.members.some((member) => member.userId === req.userId)) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "无权访问该附件" });
    }

    const stream = await (await import("../../../../infra/storage/minio.mjs")).minioClient.getObject(
      process.env.MINIO_BUCKET_CHAT_FILES || "chat-files",
      objectKey,
    );
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name || "attachment")}`);
    stream.pipe(res);
  });

  router.post("/chat/files/presign-upload", async (req, res) => {
    const conversationId = typeof req.body?.conversationId === "string" ? req.body.conversationId : "";
    const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
    const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim() : "";
    const size = typeof req.body?.size === "number" ? req.body.size : NaN;
    if (!conversationId || !fileName) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "conversationId 和 fileName 必填" });
    }
    if (!isAllowedChatMimeType(mimeType)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件类型不支持" });
    }
    if (!ensureChatFileSize(size)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `文件大小不能超过 ${CHAT_FILE_MAX_BYTES} 字节` });
    }

    const fakeReq = { ...req, params: { conversationId } };
    const ctx = await requireConversation(fakeReq, res);
    if (!ctx) return;

    const objectKey = buildChatObjectKey(conversationId, fileName);
    const uploadUrl = await presignChatUpload(objectKey);
    return res.status(201).json({
      ok: true,
      data: {
        objectKey,
        uploadUrl,
        expiresInSeconds: CHAT_FILE_PRESIGN_TTL_SECONDS,
        headers: {
          "Content-Type": mimeType || "application/octet-stream",
        },
      },
    });
  });

  router.get("/chat/files/presign-download", async (req, res) => {
    const objectKey = typeof req.query.objectKey === "string" ? req.query.objectKey : "";
    if (!objectKey) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "objectKey 必填" });
    }

    const file = await prisma.chatFile.findUnique({
      where: { objectKey },
      include: {
        message: {
          include: {
            conversation: {
              include: { members: true },
            },
          },
        },
      },
    });
    if (!file) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "附件不存在" });
    }
    if (!isObjectKeyInConversation(objectKey, file.message.conversationId.toString())) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "objectKey 无效" });
    }
    if (!file.message.conversation.members.some((member) => member.userId === req.userId)) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "无权访问该附件" });
    }
    if (file.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({ ok: false, code: "FILE_EXPIRED", message: "附件已过期" });
    }

    const downloadUrl = await presignChatDownload(objectKey);
    return res.json({
      ok: true,
      data: {
        objectKey,
        downloadUrl,
        expiresInSeconds: CHAT_FILE_PRESIGN_TTL_SECONDS,
      },
    });
  });

  router.get("/conversations", async (req, res) => {
    const rows = await prisma.chatConversation.findMany({
      where: {
        members: { some: { userId: req.userId } },
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
    return res.status(created.statusCode).json({
      ok: true,
      data: await buildConversationResponse(req.userId, created.conversation),
    });
  });

  router.get("/conversations/:conversationId/participants", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;

    const participants = ctx.conversation.members
      .map((member) => sanitizeUser(member.user))
      .filter(Boolean);
    return res.json({ ok: true, data: participants });
  });

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

    const message = await prisma.chatMessage.findFirst({
      where: { id: BigInt(req.params.messageId), conversationId: ctx.conversation.id },
      include: { filesMeta: true },
    }).catch(() => null);
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

  router.delete("/conversations/:conversationId/messages/:messageId", async (req, res) => {
    const ctx = await requireConversation(req, res);
    if (!ctx) return;

    const message = await prisma.chatMessage.findFirst({
      where: { id: BigInt(req.params.messageId), conversationId: ctx.conversation.id },
      include: { filesMeta: true },
    }).catch(() => null);
    if (!message || message.deletedAt) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "消息不存在" });
    }
    if (message.senderId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能删除自己的消息" });
    }

    await Promise.all(
      (message.filesMeta || []).map((file) => prisma.chatFile.delete({ where: { id: file.id } }).catch(() => {})),
    );
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

  router.post("/maintenance/chat-files/cleanup", async (_req, res) => {
    const count = await cleanupExpiredChatFiles();
    return res.json({ ok: true, data: { count } });
  });

  return router;
}
