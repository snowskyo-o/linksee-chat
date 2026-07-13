import { env } from "../../../../infra/config/env.mjs";
import { minioClient, toPublicMinioUrl } from "../../../../infra/storage/minio.mjs";
import {
  buildChatObjectKey,
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  CHAT_FILE_RETENTION_MS,
  normalizeDisplayFileName,
} from "./chat-file-policy.mjs";

export async function presignChatUpload(objectKey) {
  const url = await minioClient.presignedPutObject(env.minio.bucketChatFiles, objectKey, CHAT_FILE_PRESIGN_TTL_SECONDS);
  return toPublicMinioUrl(url);
}

export async function presignChatDownload(objectKey) {
  const url = await minioClient.presignedGetObject(env.minio.bucketChatFiles, objectKey, CHAT_FILE_PRESIGN_TTL_SECONDS);
  return toPublicMinioUrl(url);
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

export async function readMinioObjectBuffer(objectKey) {
  const stream = await minioClient.getObject(env.minio.bucketChatFiles, objectKey);
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function removeChatStorageObject(objectKey) {
  return minioClient.removeObject(env.minio.bucketChatFiles, objectKey);
}
