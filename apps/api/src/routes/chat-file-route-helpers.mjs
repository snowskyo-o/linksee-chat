import { CHAT_FILE_MAX_BYTES, ensureChatFileSize, isAllowedChatMimeType } from "../services/chat-file-service.mjs";

export function readObjectKeyQuery(query) {
  return typeof query?.objectKey === "string" ? query.objectKey : "";
}

export function validateObjectKey(objectKey) {
  return objectKey ? "" : "objectKey 必填";
}

export function readPresignUploadPayload(body) {
  return {
    conversationId: typeof body?.conversationId === "string" ? body.conversationId : "",
    fileName: typeof body?.fileName === "string" ? body.fileName.trim() : "",
    mimeType: typeof body?.mimeType === "string" ? body.mimeType.trim() : "",
    size: typeof body?.size === "number" ? body.size : NaN,
  };
}

export function readDirectUploadPayload(req) {
  return {
    buffer: req.body,
    conversationId: typeof req.headers["x-conversation-id"] === "string" ? req.headers["x-conversation-id"].trim() : "",
    fileName: typeof req.headers["x-file-name"] === "string" ? decodeURIComponent(req.headers["x-file-name"]).trim() : "",
    mimeType: typeof req.headers["content-type"] === "string" ? req.headers["content-type"].trim() : "",
    size: Number(req.headers["x-file-size"] || req.body?.length || 0),
  };
}

export function validateUploadRequest({ conversationId, fileName, mimeType, size }) {
  if (!conversationId || !fileName) return "conversationId 和 fileName 必填";
  if (!isAllowedChatMimeType(mimeType)) return "文件类型不支持";
  if (!ensureChatFileSize(size)) return `文件大小不能超过 ${CHAT_FILE_MAX_BYTES} 字节`;
  return "";
}
