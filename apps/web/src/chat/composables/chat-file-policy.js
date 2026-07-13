export const CHAT_FILE_MAX_BYTES = 500 * 1024 * 1024;

const ALLOWED_CHAT_MIME_TYPES = new Set([
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

export function isAllowedChatMimeType(mimeType = "") {
  const normalized = String(mimeType || "").trim().toLowerCase();
  if (!normalized) return true;
  if (ALLOWED_CHAT_MIME_TYPES.has(normalized)) return true;
  return normalized.startsWith("text/");
}

export function validateChatFile(file) {
  if (!file) return { ok: false, reason: "missing" };
  const size = Number(file.size || 0);
  if (!size) return { ok: false, reason: "empty" };
  if (size > CHAT_FILE_MAX_BYTES) return { ok: false, reason: "tooLarge" };
  if (!isAllowedChatMimeType(file.type || "application/octet-stream")) {
    return { ok: false, reason: "unsupportedType" };
  }
  return { ok: true };
}
