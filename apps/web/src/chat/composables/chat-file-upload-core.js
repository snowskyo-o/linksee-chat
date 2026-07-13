import { appendAppLog } from "../../shared/app-log.js";
import { chatApi } from "../../shared/api-client.js";

async function uploadWithPresign(store, file, updateProgress) {
  const presign = await chatApi.postJson("/api/v1/chat/files/presign-upload", {
    conversationId: store.selectedId.value,
    fileName: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
  });
  const data = presign.data || {};
  await chatApi.putExternal(
    data.uploadUrl,
    file,
    data.headers || { "Content-Type": file.type || "application/octet-stream" },
    updateProgress,
  );
  return {
    name: file.name || "attachment",
    objectKey: data.objectKey,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadedAt: new Date().toISOString(),
  };
}

async function uploadWithDirectFallback(store, file, updateProgress, error) {
  appendAppLog({ level: "warn", category: "file", message: "预签名上传失败，切换到服务端直传", meta: error?.message || "" });
  const payload = await chatApi.postBinary("/api/v1/chat/files/upload-direct", file, {
    "Content-Type": file.type || "application/octet-stream",
    "X-Conversation-Id": store.selectedId.value,
    "X-File-Name": encodeURIComponent(file.name || "attachment"),
    "X-File-Size": String(file.size || 0),
  });
  updateProgress({ percent: 100 });
  return payload.data || {
    name: file.name || "attachment",
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
}

export async function uploadChatFile(store, file, updateProgress) {
  try {
    return await uploadWithPresign(store, file, updateProgress);
  } catch (error) {
    return uploadWithDirectFallback(store, file, updateProgress, error);
  }
}
