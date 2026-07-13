import express, { Router } from "express";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { requireConversation } from "../services/chat-domain.mjs";
import {
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  buildChatObjectKey,
  cleanupExpiredChatFiles,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInConversation,
  presignChatDownload,
  presignChatUpload,
  uploadChatFile,
} from "../services/chat-file-service.mjs";

export function createChatFileRouter() {
  const router = Router();

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

  router.post("/maintenance/chat-files/cleanup", async (_req, res) => {
    const count = await cleanupExpiredChatFiles();
    return res.json({ ok: true, data: { count } });
  });

  return router;
}
