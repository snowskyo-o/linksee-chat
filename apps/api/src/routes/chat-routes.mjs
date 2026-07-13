import crypto from "node:crypto";
import express, { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { createChatFriendRouter } from "./chat-friend-routes.mjs";
import {
  resolveConversationById,
  sanitizeUser,
} from "../services/chat-store.mjs";
import {
  clearConversationMemberState,
  loadConversationMessage,
  loadMessagesForConversation,
  removeChatMessageFiles,
  serializeMessage,
} from "./chat-route-helpers.mjs";
import {
} from "../services/friend-store.mjs";
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
  cloneChatFilesToConversation,
  cleanupExpiredChatFiles,
  ensureChatFileSize,
  isObjectKeyInConversation,
  isAllowedChatMimeType,
  normalizeChatFiles,
  presignChatDownload,
  presignChatUpload,
  uploadChatFile,
} from "../services/chat-file-service.mjs";

export function createChatRouter(emitConversationEvent) {
  const router = Router();
  router.use(createChatFriendRouter());

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

    const stream = await minioClient.getObject(env.minio.bucketChatFiles, objectKey);
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

  router.post("/chat/files/upload-direct", express.raw({
    type: () => true,
    limit: CHAT_FILE_MAX_BYTES + 1024 * 1024,
  }), async (req, res) => {
    const conversationId = typeof req.headers["x-conversation-id"] === "string" ? req.headers["x-conversation-id"].trim() : "";
    const fileName = typeof req.headers["x-file-name"] === "string"
      ? decodeURIComponent(req.headers["x-file-name"]).trim()
      : "";
    const mimeType = typeof req.headers["content-type"] === "string" ? req.headers["content-type"].trim() : "";
    const sizeHeader = Number(req.headers["x-file-size"] || req.body?.length || 0);

    if (!conversationId || !fileName) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "conversationId 和 fileName 必填" });
    }
    if (!isAllowedChatMimeType(mimeType)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件类型不支持" });
    }
    if (!ensureChatFileSize(sizeHeader)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `文件大小不能超过 ${CHAT_FILE_MAX_BYTES} 字节` });
    }

    const fakeReq = { ...req, params: { conversationId } };
    const ctx = await requireConversation(fakeReq, res);
    if (!ctx) return;

    const uploaded = await uploadChatFile({
      conversationId,
      fileName,
      mimeType,
      size: sizeHeader,
      buffer: req.body,
    });

    return res.status(201).json({
      ok: true,
      data: uploaded,
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

  router.post("/maintenance/chat-files/cleanup", async (_req, res) => {
    const count = await cleanupExpiredChatFiles();
    return res.json({ ok: true, data: { count } });
  });

  return router;
}
