import { CHAT_FILE_RETENTION_MS, normalizeDisplayFileName } from "./chat-file-policy.mjs";
import { readMinioObjectBuffer, uploadChatFile } from "./chat-file-storage.mjs";

export async function cloneChatFilesToConversation(files = [], targetConversationId, fileRows = []) {
  if (!Array.isArray(files) || !files.length) return [];
  const rowMap = new Map(fileRows.map((row) => [row.objectKey, row]));
  return Promise.all(files.map(async (file) => {
    const sourceObjectKey = String(file?.objectKey || "");
    const sourceRow = rowMap.get(sourceObjectKey);
    const nextName = normalizeDisplayFileName(file?.name || sourceRow?.name || "attachment");
    const nextMimeType = String(file?.mimeType || sourceRow?.mimeType || "application/octet-stream");
    const payload = await readMinioObjectBuffer(sourceObjectKey);
    const uploaded = await uploadChatFile({
      conversationId: targetConversationId,
      fileName: nextName,
      mimeType: nextMimeType,
      size: Number(file?.size || sourceRow?.size || payload.length || 0),
      buffer: payload,
      ttlMs: sourceRow?.expiresAt
        ? Math.max(60 * 1000, new Date(sourceRow.expiresAt).getTime() - Date.now())
        : CHAT_FILE_RETENTION_MS,
    });
    return {
      name: uploaded.name,
      objectKey: uploaded.objectKey,
      size: uploaded.size,
      mimeType: uploaded.mimeType,
      uploadedAt: uploaded.uploadedAt,
      expiresAt: uploaded.expiresAt,
    };
  }));
}
