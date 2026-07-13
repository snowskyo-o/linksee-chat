import crypto from "node:crypto";
import path from "node:path";

export const CHAT_FILE_MAX_BYTES = 500 * 1024 * 1024;
export const CHAT_FILE_PRESIGN_TTL_SECONDS = 30 * 60;
export const CHAT_FILE_RETENTION_DAYS = 7;
export const CHAT_FILE_RETENTION_MS = CHAT_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const allowedMimeTypes = new Set([
  "application/pdf", "application/zip", "application/x-zip-compressed", "application/x-rar-compressed",
  "application/vnd.rar", "application/x-7z-compressed", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/json", "application/xml",
  "text/xml", "text/markdown", "text/x-yaml", "application/x-yaml", "text/yaml", "image/jpeg", "image/png",
  "image/webp", "image/gif", "video/mp4", "video/webm", "video/quicktime", "application/octet-stream",
]);

function sanitizeFileName(originalName) {
  const safeName = path.basename(String(originalName || "")).replace(/[^A-Za-z0-9._-]+/g, "_");
  return safeName.length > 0 ? safeName : "file";
}

export function normalizeDisplayFileName(originalName) {
  const safeName = path.basename(String(originalName || "")).trim();
  return safeName || "file";
}

export function buildFileSummary(files) {
  if (!Array.isArray(files) || files.length === 0) return "附件";
  if (files.length === 1) return files[0].name || "附件";
  if (files.length === 2) return `${files[0].name || "附件"}、${files[1].name || "附件"}`;
  return `${files[0].name || "附件"} 等 ${files.length} 个文件`;
}

export function isAllowedChatMimeType(mimeType) {
  if (typeof mimeType !== "string" || mimeType.length === 0) return false;
  if (allowedMimeTypes.has(mimeType)) return true;
  return mimeType.startsWith("text/");
}

export function ensureChatFileSize(size) {
  return Number.isFinite(size) && size > 0 && size <= CHAT_FILE_MAX_BYTES;
}

export function buildChatObjectKey(conversationId, fileName) {
  return `chat/conversation/${conversationId}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

export function isObjectKeyInConversation(objectKey, conversationId) {
  return typeof objectKey === "string" && objectKey.startsWith(`chat/conversation/${conversationId}/`);
}

export function normalizeChatFiles(files) {
  if (!Array.isArray(files)) return [];
  return files.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const name = typeof item.name === "string" ? normalizeDisplayFileName(item.name) : "";
    const objectKey = typeof item.objectKey === "string" ? item.objectKey : "";
    const size = typeof item.size === "number" ? item.size : NaN;
    const mimeType = typeof item.mimeType === "string" ? item.mimeType : "";
    const uploadedAt = typeof item.uploadedAt === "string" ? item.uploadedAt : new Date().toISOString();
    if (!name || !objectKey || !Number.isFinite(size) || !mimeType) return [];
    return [{ name, objectKey, size, mimeType, uploadedAt }];
  });
}
