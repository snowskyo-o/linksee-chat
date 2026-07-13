import { prisma } from "../../../../infra/db/prisma.mjs";
import { parseMentions, validateContent } from "./chat-domain.mjs";
import {
  CHAT_FILE_MAX_BYTES,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInConversation,
  normalizeChatFiles,
} from "./chat-file-service.mjs";

async function resolveMentions(conversationId, req, content) {
  return Array.isArray(req.body?.mentions)
    ? req.body.mentions.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
    : parseMentions(conversationId, content);
}

async function validateReplyToId(replyToId, conversationId, res) {
  if (!replyToId) return true;
  const replyMessage = await prisma.chatMessage.findFirst({
    where: { id: BigInt(replyToId), conversationId },
    select: { id: true },
  }).catch(() => null);
  if (replyMessage) return true;
  res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "replyToId 无效" });
  return false;
}

function validateMentions(mentions, participantIds, res) {
  if (mentions.length > 20) {
    res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "mentions 不能超过 20 个" });
    return false;
  }
  const invalidMentions = mentions.filter((userId) => !participantIds.has(userId));
  if (invalidMentions.length === 0) return true;
  res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `mentions 必须在当前会话内: ${invalidMentions.join(", ")}` });
  return false;
}

function validateFiles(filesInput, conversationId, res) {
  for (const file of filesInput) {
    if (!ensureChatFileSize(file.size)) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `文件大小不能超过 ${CHAT_FILE_MAX_BYTES} 字节` });
      return false;
    }
    if (!isAllowedChatMimeType(file.mimeType)) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: `不支持的类型: ${file.mimeType}` });
      return false;
    }
    if (!isObjectKeyInConversation(file.objectKey, conversationId.toString())) {
      res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "文件 objectKey 与当前会话不匹配" });
      return false;
    }
  }
  return true;
}

export async function validateCreateMessagePayload({ conversationId, ctx, req, res }) {
  const messageType = typeof req.body?.type === "string" ? req.body.type : "text";
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const replyToId = typeof req.body?.replyToId === "string" ? req.body.replyToId : null;
  const filesInput = normalizeChatFiles(req.body?.files);
  const mentions = await resolveMentions(conversationId, req, content);

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
  if (!(await validateReplyToId(replyToId, ctx.conversation.id, res))) return null;
  if (!validateFiles(filesInput, ctx.conversation.id, res)) return null;
  if (!validateMentions(mentions, new Set(ctx.conversation.members.map((member) => member.userId)), res)) return null;

  return { content, filesInput, mentions, messageType, replyToId };
}
