import crypto from "node:crypto";
import express, { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import {
  buildMessageType,
  findContacts,
  sanitizeUser,
} from "../services/chat-store.mjs";
import {
  ensureFriendship,
  findFriendship,
  listFriendDiscovery,
  listFriendRequestsForUser,
  updateFriendAlias,
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
  cleanupExpiredChatFiles,
  enrichChatFilesForResponse,
  ensureChatFileSize,
  isObjectKeyInConversation,
  isAllowedChatMimeType,
  normalizeChatFiles,
  presignChatDownload,
  presignChatUpload,
  uploadChatFile,
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

async function removeChatMessageFiles(message) {
  const filesMeta = Array.isArray(message.filesMeta) ? message.filesMeta : [];
  const objectKeys = filesMeta.flatMap((file) => [file.objectKey, file.thumbnailKey].filter(Boolean));

  await Promise.all(
    objectKeys.map((key) => minioClient.removeObject(env.minio.bucketChatFiles, key).catch(() => {})),
  );
  await Promise.all(
    filesMeta.map((file) => prisma.chatFile.delete({ where: { id: file.id } }).catch(() => {})),
  );
}

async function loadConversationMessage(req, res, conversationId, messageId) {
  return prisma.chatMessage.findFirst({
    where: { id: BigInt(messageId), conversationId },
    include: {
      sender: { include: { profile: true } },
      replyTo: { include: { filesMeta: true } },
      filesMeta: true,
    },
  }).catch(() => {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "消息不存在" });
    return null;
  });
}

export function createChatRouter(emitConversationEvent) {
  const router = Router();

  router.get("/contacts", async (req, res) => {
    const contacts = await findContacts(req.userId);
    return res.json({ ok: true, data: contacts });
  });

  router.get("/friends/discovery", async (req, res) => {
    const keyword = typeof req.query.q === "string" ? req.query.q : "";
    const data = await listFriendDiscovery(req.userId, keyword);
    return res.json({ ok: true, data });
  });

  router.get("/friends/requests", async (req, res) => {
    const data = await listFriendRequestsForUser(req.userId);
    return res.json({ ok: true, data });
  });

  router.post("/friends/requests", async (req, res) => {
    const receiverId = typeof req.body?.receiverId === "string" ? req.body.receiverId.trim() : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 200) : "";
    if (!receiverId || receiverId === req.userId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "receiverId 无效" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: receiverId },
      include: { profile: true },
    });
    if (!targetUser || !targetUser.isActive) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "用户不存在" });
    }

    const existingFriendship = await findFriendship(req.userId, receiverId);
    if (existingFriendship) {
      return res.status(409).json({ ok: false, code: "ALREADY_FRIEND", message: "已经是好友" });
    }

    const upserted = await prisma.chatFriendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: req.userId,
          receiverId,
        },
      },
      update: {
        status: "pending",
        message,
        processedAt: null,
      },
      create: {
        senderId: req.userId,
        receiverId,
        message,
      },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    return res.status(201).json({
      ok: true,
      data: {
        id: upserted.id.toString(),
        status: upserted.status,
        senderId: upserted.senderId,
        receiverId: upserted.receiverId,
        message: upserted.message || "",
        sender: sanitizeUser(upserted.sender),
        receiver: sanitizeUser(upserted.receiver),
        updatedAt: upserted.updatedAt.toISOString(),
      },
    });
  });

  router.patch("/friends/requests/:requestId", async (req, res) => {
    const action = typeof req.body?.action === "string" ? req.body.action.trim() : "";
    if (!["accept", "reject", "cancel"].includes(action)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "action 无效" });
    }

    const requestRow = await prisma.chatFriendRequest.findUnique({
      where: { id: BigInt(req.params.requestId) },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    }).catch(() => null);

    if (!requestRow) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "申请不存在" });
    }
    if (requestRow.status !== "pending") {
      return res.status(409).json({ ok: false, code: "REQUEST_FINISHED", message: "该申请已处理" });
    }

    if (action === "cancel") {
      if (requestRow.senderId !== req.userId) {
        return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能取消自己发出的申请" });
      }
    } else if (requestRow.receiverId !== req.userId) {
      return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "只能处理发给自己的申请" });
    }

    const nextStatus = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "canceled";
    const updated = await prisma.chatFriendRequest.update({
      where: { id: requestRow.id },
      data: {
        status: nextStatus,
        processedAt: new Date(),
      },
      include: {
        sender: { include: { profile: true } },
        receiver: { include: { profile: true } },
      },
    });

    if (action === "accept") {
      await ensureFriendship(updated.senderId, updated.receiverId);
    }

    return res.json({
      ok: true,
      data: {
        id: updated.id.toString(),
        status: updated.status,
        senderId: updated.senderId,
        receiverId: updated.receiverId,
        message: updated.message || "",
        sender: sanitizeUser(updated.sender),
        receiver: sanitizeUser(updated.receiver),
        updatedAt: updated.updatedAt.toISOString(),
        processedAt: updated.processedAt?.toISOString() || null,
      },
    });
  });

  router.patch("/friends/:friendUserId/alias", async (req, res) => {
    const friendUserId = typeof req.params.friendUserId === "string" ? req.params.friendUserId.trim() : "";
    const alias = typeof req.body?.alias === "string" ? req.body.alias.trim() : "";
    if (!friendUserId || friendUserId === req.userId) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "friendUserId 无效" });
    }
    if (alias.length > 40) {
      return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "备注不能超过 40 个字符" });
    }

    const updated = await updateFriendAlias(req.userId, friendUserId, alias);
    if (!updated) {
      return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "好友关系不存在" });
    }

    return res.json({
      ok: true,
      data: {
        friendUserId,
        alias,
      },
    });
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

    const message = await loadConversationMessage(req, res, ctx.conversation.id, req.params.messageId);
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

    const message = await loadConversationMessage(req, res, ctx.conversation.id, req.params.messageId);
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

    const message = await loadConversationMessage(req, res, ctx.conversation.id, req.params.messageId);
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
