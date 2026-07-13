import crypto from "node:crypto";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { parseMentions, validateContent } from "./chat-domain.mjs";
import {
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_RETENTION_MS,
  buildFileSummary,
  cloneChatFilesToConversation,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInConversation,
  normalizeChatFiles,
} from "./chat-file-service.mjs";

function messageInclude() {
  return {
    sender: { include: { profile: true } },
    replyTo: { include: { filesMeta: true } },
    filesMeta: true,
  };
}

export async function validateCreateMessagePayload({ conversationId, ctx, req, res }) {
  const messageType = typeof req.body?.type === "string" ? req.body.type : "text";
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const replyToId = typeof req.body?.replyToId === "string" ? req.body.replyToId : null;
  const filesInput = normalizeChatFiles(req.body?.files);
  const mentions = Array.isArray(req.body?.mentions)
    ? req.body.mentions.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
    : await parseMentions(conversationId, content);

  if (messageType !== "text" && messageType !== "file") {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "type 必须是 text 或 file" });
    return null;
  }
  if (messageType === "text") {
    if (!validateContent(content, res)) return null;
    if (filesInput.length > 0) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文本消息不能附带 files" });
      return null;
    }
  }
  if (messageType === "file" && filesInput.length === 0) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件消息必须携带 files" });
    return null;
  }
  if (replyToId) {
    const replyMessage = await prisma.chatMessage.findFirst({
      where: { id: BigInt(replyToId), conversationId: ctx.conversation.id },
      select: { id: true },
    }).catch(() => null);
    if (!replyMessage) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "replyToId 无效" });
      return null;
    }
  }
  if (mentions.length > 20) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "mentions 不能超过 20 个" });
    return null;
  }
  for (const file of filesInput) {
    if (!ensureChatFileSize(file.size)) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `文件大小不能超过 ${CHAT_FILE_MAX_BYTES} 字节` });
      return null;
    }
    if (!isAllowedChatMimeType(file.mimeType)) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `不支持的类型: ${file.mimeType}` });
      return null;
    }
    if (!isObjectKeyInConversation(file.objectKey, ctx.conversation.id.toString())) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件 objectKey 与当前会话不匹配" });
      return null;
    }
  }
  const participantIds = new Set(ctx.conversation.members.map((member) => member.userId));
  const invalidMentions = mentions.filter((userId) => !participantIds.has(userId));
  if (invalidMentions.length > 0) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `mentions 必须在当前会话内: ${invalidMentions.join(", ")}` });
    return null;
  }

  return { content, filesInput, mentions, messageType, replyToId };
}

export async function createChatMessage({ conversationId, payload, userId }) {
  return prisma.chatMessage.create({
    data: {
      conversationId,
      senderId: userId,
      content: payload.messageType === "file" ? (payload.content || buildFileSummary(payload.filesInput)) : payload.content,
      files: payload.filesInput.length > 0 ? payload.filesInput : null,
      mentions: payload.mentions,
      replyToId: payload.replyToId ? BigInt(payload.replyToId) : null,
      eventId: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
      filesMeta: payload.filesInput.length > 0
        ? {
            create: payload.filesInput.map((file) => ({
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
    include: messageInclude(),
  });
}

export async function createForwardMessage({ req, res, targetConversationId, targetCtx }) {
  const sourceConversationId = typeof req.body?.sourceConversationId === "string" ? req.body.sourceConversationId.trim() : "";
  const sourceMessageId = typeof req.body?.sourceMessageId === "string" ? req.body.sourceMessageId.trim() : "";
  if (!sourceConversationId || !sourceMessageId) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "sourceConversationId 和 sourceMessageId 必填" });
    return null;
  }

  const sourceConversation = await prisma.chatConversation.findFirst({
    where: {
      id: BigInt(sourceConversationId),
      members: { some: { userId: req.userId } },
    },
    include: { members: true },
  }).catch(() => null);
  if (!sourceConversation) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "源会话不存在" });
    return null;
  }

  const sourceMessage = await prisma.chatMessage.findFirst({
    where: {
      id: BigInt(sourceMessageId),
      conversationId: sourceConversation.id,
      deletedAt: null,
    },
    include: messageInclude(),
  }).catch(() => null);
  if (!sourceMessage) {
    res.status(404).json({ ok: false, code: "NOT_FOUND", message: "源消息不存在" });
    return null;
  }

  const sourceFiles = Array.isArray(sourceMessage.files) ? sourceMessage.files : [];
  const nextFiles = sourceFiles.length
    ? await cloneChatFilesToConversation(sourceFiles, targetConversationId, sourceMessage.filesMeta || [])
    : [];
  const nextType = nextFiles.length ? "file" : "text";
  const nextContent = nextFiles.length ? buildFileSummary(nextFiles) : String(sourceMessage.content || "").trim();
  if (!nextFiles.length && !validateContent(nextContent, res)) return null;

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
    include: messageInclude(),
  });

  return {
    created,
    forwardedFromConversationId: sourceConversationId,
    forwardedFromMessageId: sourceMessageId,
    type: nextType,
  };
}
