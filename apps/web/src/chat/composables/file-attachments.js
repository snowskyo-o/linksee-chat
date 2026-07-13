import { formatFileSize } from "../../shared/utils.js";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp", "image/svg+xml"]);

export function isImageFileLike(file) {
  const mimeType = String(file?.type || file?.mimeType || "").toLowerCase();
  if (mimeType) return IMAGE_TYPES.has(mimeType) || mimeType.startsWith("image/");
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(String(file?.name || ""));
}

export function getFileExtensionLabel(name = "", mimeType = "") {
  const ext = String(name || "").split(".").pop();
  if (ext && ext !== name) return ext.slice(0, 4).toUpperCase();
  const tail = String(mimeType || "").split("/").pop();
  return tail ? tail.slice(0, 4).toUpperCase() : "FILE";
}

export function dedupeFileList(fileList) {
  const seen = new Set();
  const unique = [];
  for (const file of Array.from(fileList || []).filter(Boolean)) {
    const key = [file.name || "", file.size || 0, file.lastModified || 0].join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(file);
  }
  return unique;
}

export function createPendingAttachment(file) {
  const isImage = isImageFileLike(file);
  return {
    id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    name: file.name || "attachment",
    size: file.size || 0,
    lastModified: file.lastModified || Date.now(),
    sizeText: formatFileSize(file.size || 0),
    mimeType: file.type || "application/octet-stream",
    isImage,
    previewUrl: isImage ? URL.createObjectURL(file) : "",
    extensionLabel: getFileExtensionLabel(file.name, file.type),
    uploadStatus: "pending",
    uploadProgress: 0,
    uploadError: "",
  };
}

export function restorePendingAttachment(entry = {}) {
  const blob = entry?.blob instanceof Blob
    ? entry.blob
    : new Blob([entry?.blob || []], { type: entry?.mimeType || "application/octet-stream" });
  const file = new File([blob], entry?.name || "attachment", {
    type: entry?.mimeType || blob.type || "application/octet-stream",
    lastModified: Number(entry?.lastModified || Date.now()),
  });
  return createPendingAttachment(file);
}

export function revokePendingAttachment(item) {
  if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
}
