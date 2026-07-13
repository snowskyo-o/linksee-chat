import { prisma } from "../../../../infra/db/prisma.mjs";
import { cloneChatFilesToConversation } from "./chat-file-clone.mjs";
import {
  buildChatObjectKey,
  buildFileSummary,
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  CHAT_FILE_RETENTION_MS,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInConversation,
  normalizeChatFiles,
} from "./chat-file-policy.mjs";
import { enrichChatFilesForResponse } from "./chat-file-response.mjs";
import {
  presignChatDownload,
  presignChatUpload,
  removeChatStorageObject,
  uploadChatFile,
} from "./chat-file-storage.mjs";

export async function cleanupExpiredChatFiles() {
  const expired = await prisma.chatFile.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, objectKey: true, thumbnailKey: true },
  });

  if (expired.length === 0) return 0;

  await Promise.all(
    expired.flatMap((file) => {
      const keys = [file.objectKey, file.thumbnailKey].filter(Boolean);
      return keys.map((key) => removeChatStorageObject(key).catch(() => {}));
    }),
  );

  await prisma.chatFile.deleteMany({
    where: { id: { in: expired.map((file) => file.id) } },
  });

  return expired.length;
}

export {
  buildChatObjectKey,
  buildFileSummary,
  CHAT_FILE_MAX_BYTES,
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  CHAT_FILE_RETENTION_MS,
  ensureChatFileSize,
  isAllowedChatMimeType,
  isObjectKeyInConversation,
  normalizeChatFiles,
  cloneChatFilesToConversation,
  enrichChatFilesForResponse,
  presignChatDownload,
  presignChatUpload,
  uploadChatFile,
};
