import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { buildMessageType, sanitizeUser } from "../services/chat-store.mjs";
import { enrichChatFilesForResponse } from "../services/chat-file-service.mjs";

export function serializeMessage(message) {
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

export async function loadMessagesForConversation(conversationId, beforeId = "", limit = 50) {
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

export async function removeChatMessageFiles(message) {
  const filesMeta = Array.isArray(message.filesMeta) ? message.filesMeta : [];
  const objectKeys = filesMeta.flatMap((file) => [file.objectKey, file.thumbnailKey].filter(Boolean));

  await Promise.all(
    objectKeys.map((key) => minioClient.removeObject(env.minio.bucketChatFiles, key).catch(() => {})),
  );
  await Promise.all(
    filesMeta.map((file) => prisma.chatFile.delete({ where: { id: file.id } }).catch(() => {})),
  );
}

export async function clearConversationMemberState(conversationId, userId) {
  await Promise.all([
    prisma.chatConversationRead.deleteMany({ where: { conversationId, userId } }),
    prisma.chatConversationPin.deleteMany({ where: { conversationId, userId } }),
    prisma.chatConversationState.deleteMany({ where: { conversationId, userId } }),
    prisma.chatConversationMember.deleteMany({ where: { conversationId, userId } }),
  ]);
}

export async function loadConversationMessage(res, conversationId, messageId) {
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
