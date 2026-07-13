import crypto from "node:crypto";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { CHAT_FILE_RETENTION_MS } from "./chat-file-service.mjs";

export function messageInclude() {
  return {
    sender: { include: { profile: true } },
    replyTo: { include: { filesMeta: true } },
    filesMeta: true,
  };
}

function buildFilesMetaCreate(filesInput) {
  return filesInput.length > 0
    ? {
        create: filesInput.map((file) => ({
          objectKey: file.objectKey,
          name: file.name,
          size: BigInt(file.size),
          mimeType: file.mimeType,
          uploadedAt: new Date(file.uploadedAt),
          expiresAt: new Date(file.expiresAt || Date.now() + CHAT_FILE_RETENTION_MS),
        })),
      }
    : undefined;
}

export async function createPersistedChatMessage({ conversationId, senderId, content, filesInput, mentions, replyToId }) {
  return prisma.chatMessage.create({
    data: {
      conversationId,
      senderId,
      content,
      files: filesInput.length > 0 ? filesInput : null,
      mentions,
      replyToId: replyToId ? BigInt(replyToId) : null,
      eventId: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
      filesMeta: buildFilesMetaCreate(filesInput),
    },
    include: messageInclude(),
  });
}
