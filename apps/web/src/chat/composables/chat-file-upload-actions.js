import { appendAppLog } from "../../shared/app-log.js";
import { chatApi } from "../../shared/api-client.js";
import { dedupeFileList } from "./file-attachments.js";
import { buildFileMessageContent } from "./message-operations.js";

function matchPendingItem(pendingItems, file) {
  return pendingItems.find((item) => item.file === file)
    || pendingItems.find((item) => (
      [item.file?.name || "", item.file?.size || 0, item.file?.lastModified || 0].join(":")
        === [file.name || "", file.size || 0, file.lastModified || 0].join(":")
    ));
}

function normalizeUploadEntries(fileList) {
  const rawItems = Array.from(fileList || []).filter(Boolean);
  const pendingItems = rawItems.filter((item) => item?.file);
  const files = pendingItems.length ? pendingItems.map((item) => item.file) : rawItems;
  return dedupeFileList(files).map((file) => ({
    file,
    pendingItem: matchPendingItem(pendingItems, file),
  }));
}

export function createChatFileUploadActions({ store, dataActions }) {
  async function uploadFiles(fileList, options = {}) {
    if (!store.selectedId.value) return;
    const entries = normalizeUploadEntries(fileList);
    if (!entries.length) return;
    const targetPendingIds = entries.map((entry) => entry.pendingItem?.id).filter(Boolean);
    store.uploadingFiles.value = true;
    store.uploadProgress.value = 0;
    store.uploadFileName.value = entries[0]?.file?.name || "";
    store.setComposerHint(`正在上传 ${entries.length} 个文件...`, "");
    appendAppLog({ level: "info", category: "file", message: `开始上传 ${entries.length} 个文件` });
    targetPendingIds.forEach((id) => {
      store.updatePendingFile(id, {
        uploadStatus: "uploading",
        uploadProgress: 0,
        uploadError: "",
      });
    });
    try {
      const uploadedFiles = [];
      for (let index = 0; index < entries.length; index += 1) {
        const { file, pendingItem } = entries[index];
        store.uploadFileName.value = file.name || `file-${index + 1}`;
        const updateProgress = ({ percent }) => {
          const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
          const scaled = Math.min(100, Math.floor(((index + safePercent / 100) / entries.length) * 100));
          store.uploadProgress.value = Math.max(Math.floor((index / entries.length) * 100), scaled);
          if (pendingItem?.id) {
            store.updatePendingFile(pendingItem.id, {
              uploadStatus: "uploading",
              uploadProgress: Math.floor(safePercent),
              uploadError: "",
            });
          }
        };
        try {
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
          uploadedFiles.push({
            name: file.name || "attachment",
            objectKey: data.objectKey,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadedAt: new Date().toISOString(),
          });
        } catch (error) {
          appendAppLog({ level: "warn", category: "file", message: "预签名上传失败，切换到服务端直传", meta: error?.message || "" });
          const payload = await chatApi.postBinary("/api/v1/chat/files/upload-direct", file, {
            "Content-Type": file.type || "application/octet-stream",
            "X-Conversation-Id": store.selectedId.value,
            "X-File-Name": encodeURIComponent(file.name || "attachment"),
            "X-File-Size": String(file.size || 0),
          });
          updateProgress({ percent: 100 });
          uploadedFiles.push(payload.data || {
            name: file.name || "attachment",
            size: file.size,
            mimeType: file.type || "application/octet-stream",
          });
        }
        if (pendingItem?.id) {
          store.updatePendingFile(pendingItem.id, {
            uploadStatus: "uploading",
            uploadProgress: 100,
            uploadError: "",
          });
        }
      }
      store.uploadProgress.value = 100;
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
        type: "file",
        content: buildFileMessageContent(uploadedFiles),
        files: uploadedFiles,
        mentions: [],
        replyToId: options.replyTo ? options.replyTo.id : (store.replyTo.value ? store.replyTo.value.id : null),
      });
      store.clearReplyState();
      store.setComposerHint(`已上传 ${uploadedFiles.length} 个文件`, "success");
      appendAppLog({ level: "info", category: "file", message: `上传完成 ${uploadedFiles.length} 个文件` });
      if (targetPendingIds.length) store.removePendingFiles(targetPendingIds);
      await dataActions.refreshSelectedConversation();
      await dataActions.loadConversations();
      await dataActions.markConversationReadIfNeeded().catch(() => {});
    } catch (error) {
      targetPendingIds.forEach((id) => {
        store.updatePendingFile(id, {
          uploadStatus: "failed",
          uploadError: error?.message || "上传失败",
        });
      });
      store.setComposerHint(error?.message || "上传失败", "error");
      appendAppLog({ level: "error", category: "file", message: "文件上传失败", meta: error?.message || "" });
      throw error;
    } finally {
      store.uploadingFiles.value = false;
      store.uploadProgress.value = 0;
      store.uploadFileName.value = "";
    }
  }

  return { uploadFiles };
}
