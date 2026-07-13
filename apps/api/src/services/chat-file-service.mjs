import crypto from "node:crypto";
import path from "node:path";
import { prisma } from "../../../../infra/db/prisma.mjs";
import { env } from "../../../../infra/config/env.mjs";
import { minioClient, toPublicMinioUrl } from "../../../../infra/storage/minio.mjs";

export const CHAT_FILE_MAX_BYTES = 500 * 1024 * 1024;
export const CHAT_FILE_PRESIGN_TTL_SECONDS = 30 * 60;
export const CHAT_FILE_RETENTION_DAYS = 7;
export const CHAT_FILE_RETENTION_MS = CHAT_FILE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
  "application/xml",
  "text/xml",
  "text/markdown",
  "text/x-yaml",
  "application/x-yaml",
  "text/yaml",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
]);

function sanitizeFileName(originalName) {
  const safeName = path.basename(String(originalName || "")).replace(/[^A-Za-z0-9._-]+/g, "_");
  return safeName.length > 0 ? safeName : "file";
}

function normalizeDisplayFileName(originalName) {
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

export async function presignChatUpload(objectKey) {
  const url = await minioClient.presignedPutObject(env.minio.bucketChatFiles, objectKey, CHAT_FILE_PRESIGN_TTL_SECONDS);
  return toPublicMinioUrl(url);
}

export async function presignChatDownload(objectKey) {
  const url = await minioClient.presignedGetObject(env.minio.bucketChatFiles, objectKey, CHAT_FILE_PRESIGN_TTL_SECONDS);
  return toPublicMinioUrl(url);
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

export async function uploadChatFile({ conversationId, fileName, mimeType, size, buffer, ttlMs = CHAT_FILE_RETENTION_MS }) {
  const objectKey = buildChatObjectKey(conversationId, fileName);
  await minioClient.putObject(env.minio.bucketChatFiles, objectKey, buffer, size, {
    "Content-Type": mimeType,
  });

  const uploadedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  return {
    name: normalizeDisplayFileName(fileName),
    objectKey,
    size,
    mimeType,
    uploadedAt,
    expiresAt,
  };
}

export function enrichChatFilesForResponse(files, fileRows = []) {
  if (!Array.isArray(files)) return [];
  const rowMap = new Map(fileRows.map((row) => [row.objectKey, row]));
  return files.map((file) => {
    const row = rowMap.get(file.objectKey);
    const expiresAt = row?.expiresAt ? new Date(row.expiresAt).toISOString() : file.expiresAt;
    const expired = Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
    return {
      name: file.name || "附件",
      objectKey: file.objectKey || "",
      size: Number(file.size || 0),
      mimeType: file.mimeType || "application/octet-stream",
      uploadedAt: file.uploadedAt || new Date().toISOString(),
      expiresAt,
      expired,
      downloadPath: expired ? "" : `/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`,
    };
  });
}

export async function cleanupExpiredChatFiles() {
  const expired = await prisma.chatFile.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true, objectKey: true, thumbnailKey: true },
  });

  if (expired.length === 0) return 0;

  await Promise.all(
    expired.flatMap((file) => {
      const keys = [file.objectKey, file.thumbnailKey].filter(Boolean);
      return keys.map((key) => minioClient.removeObject(env.minio.bucketChatFiles, key).catch(() => {}));
    }),
  );

  await prisma.chatFile.deleteMany({
    where: { id: { in: expired.map((file) => file.id) } },
  });

  return expired.length;
}
