import { appendAppLog } from "../../shared/app-log.js";
import { chatApi } from "../../shared/api-client.js";
import { uploadChatFile } from "./chat-file-upload-core.js";
import { normalizeUploadEntries, updatePendingUploads } from "./chat-file-upload-entries.js";
import { buildFileMessageContent } from "./message-operations.js";

export function createChatFileUploadActions({ store, dataActions }) {
  const resetUploadState = () => {
    store.uploadingFiles.value = false;
    store.uploadProgress.value = 0;
    store.uploadFileName.value = "";
  };

  const refreshConversationAfterUpload = async () => {
    await dataActions.refreshSelectedConversation();
    await dataActions.loadConversations();
    await dataActions.markConversationReadIfNeeded().catch(() => {});
  };

  const createProgressUpdater = (entries, index, pendingItem) => ({ percent }) => {
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
    updatePendingUploads(store, targetPendingIds, { uploadStatus: "uploading", uploadProgress: 0, uploadError: "" });
    try {
      const uploadedFiles = [];
      for (let index = 0; index < entries.length; index += 1) {
        const { file, pendingItem } = entries[index];
        store.uploadFileName.value = file.name || `file-${index + 1}`;
        const updateProgress = createProgressUpdater(entries, index, pendingItem);
        uploadedFiles.push(await uploadChatFile(store, file, updateProgress));
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
      await refreshConversationAfterUpload();
    } catch (error) {
      updatePendingUploads(store, targetPendingIds, { uploadStatus: "failed", uploadError: error?.message || "上传失败" });
      store.setComposerHint(error?.message || "上传失败", "error");
      appendAppLog({ level: "error", category: "file", message: "文件上传失败", meta: error?.message || "" });
      throw error;
    } finally {
      resetUploadState();
    }
  }

  return { uploadFiles };
}
