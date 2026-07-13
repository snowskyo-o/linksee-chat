import { env } from "../../../../infra/config/env.mjs";
import { minioClient } from "../../../../infra/storage/minio.mjs";
import { requireConversation } from "../services/chat-domain.mjs";
import {
  CHAT_FILE_PRESIGN_TTL_SECONDS,
  buildChatObjectKey,
  cleanupExpiredChatFiles,
  isObjectKeyInConversation,
  presignChatDownload,
  presignChatUpload,
  uploadChatFile,
} from "../services/chat-file-service.mjs";
import {
  readDirectUploadPayload,
  readObjectKeyQuery,
  readPresignUploadPayload,
  validateObjectKey,
  validateUploadRequest,
} from "./chat-file-route-helpers.mjs";
import { canAccessChatFile, chatFileExpired, findChatFile } from "./chat-file-records.mjs";

export async function downloadChatFile(req, res) {
  const objectKey = readObjectKeyQuery(req.query), validationError = validateObjectKey(objectKey);
  if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });
  const file = await findChatFile(objectKey);
  if (!file) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "附件不存在" });
  if (chatFileExpired(file)) return res.status(410).json({ ok: false, code: "FILE_EXPIRED", message: "附件已过期" });
  if (!canAccessChatFile(file, req.userId)) return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "无权访问该附件" });

  const stream = await minioClient.getObject(env.minio.bucketChatFiles, objectKey);
  res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.name || "attachment")}`);
  stream.pipe(res);
}

export async function presignUploadChatFile(req, res) {
  const payload = readPresignUploadPayload(req.body), validationError = validateUploadRequest(payload);
  if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });
  const ctx = await requireConversation({ ...req, params: { conversationId: payload.conversationId } }, res);
  if (!ctx) return;
  const objectKey = buildChatObjectKey(payload.conversationId, payload.fileName);
  const uploadUrl = await presignChatUpload(objectKey);
  return res.status(201).json({
    ok: true,
    data: {
      objectKey,
      uploadUrl,
      expiresInSeconds: CHAT_FILE_PRESIGN_TTL_SECONDS,
      headers: { "Content-Type": payload.mimeType || "application/octet-stream" },
    },
  });
}

export async function uploadDirectChatFile(req, res) {
  const payload = readDirectUploadPayload(req), validationError = validateUploadRequest(payload);
  if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });
  const ctx = await requireConversation({ ...req, params: { conversationId: payload.conversationId } }, res);
  if (!ctx) return;
  const uploaded = await uploadChatFile({
    conversationId: payload.conversationId,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    size: payload.size,
    buffer: payload.buffer,
  });
  return res.status(201).json({ ok: true, data: uploaded });
}

export async function presignDownloadChatFile(req, res) {
  const objectKey = readObjectKeyQuery(req.query), validationError = validateObjectKey(objectKey);
  if (validationError) return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: validationError });
  const file = await findChatFile(objectKey);
  if (!file) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "附件不存在" });
  if (!isObjectKeyInConversation(objectKey, file.message.conversationId.toString())) {
    return res.status(400).json({ ok: false, code: "VALIDATION_FAILED", message: "objectKey 无效" });
  }
  if (!canAccessChatFile(file, req.userId)) return res.status(403).json({ ok: false, code: "FORBIDDEN", message: "无权访问该附件" });
  if (chatFileExpired(file)) return res.status(410).json({ ok: false, code: "FILE_EXPIRED", message: "附件已过期" });

  const downloadUrl = await presignChatDownload(objectKey);
  return res.json({
    ok: true,
    data: {
      objectKey,
      downloadUrl,
      expiresInSeconds: CHAT_FILE_PRESIGN_TTL_SECONDS,
    },
  });
}

export async function cleanupChatFiles(_req, res) {
  const count = await cleanupExpiredChatFiles();
  return res.json({ ok: true, data: { count } });
}
