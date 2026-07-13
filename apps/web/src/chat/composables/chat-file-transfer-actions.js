import { appendAppLog } from "../../shared/app-log.js";
import { chatApi } from "../../shared/api-client.js";
import { dedupeFileList, isImageFileLike } from "./file-attachments.js";
import {
  buildFileMessageContent,
  findMessage,
  normalizeMessage,
  patchConversationLocally,
  patchMessageLocally,
  removeMessageLocally,
  replaceMessageLocally,
  syncConversationPreview,
} from "./message-operations.js";
import { pickVisibleConversationPreview, rememberLocallyDeletedMessage } from "./message-visibility-cache.js";

export function createChatFileTransferActions({ store, dataActions, autoReceiveQueue, postTextMessage }) {
  async function retryMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState !== "failed") return;
    patchMessageLocally(store, messageId, { operationState: "sending", sendError: "" });
    try {
      await postTextMessage(message.content || "", message.mentions || [], message.replyTo || null, message);
      appendAppLog({ level: "info", category: "message", message: "消息重试发送成功", meta: (message.content || "").slice(0, 80) });
    } catch (error) {
      patchMessageLocally(store, messageId, {
        operationState: "failed",
        sendError: error?.message || "发送失败",
      });
      appendAppLog({ level: "error", category: "message", message: "消息重试失败", meta: error?.message || "" });
      throw error;
    }
  }

  async function uploadFiles(fileList, options = {}) {
    if (!store.selectedId.value) return;
    const rawItems = Array.from(fileList || []).filter(Boolean);
    const pendingItems = rawItems.filter((item) => item?.file);
    const entries = dedupeFileList(pendingItems.length ? pendingItems.map((item) => item.file) : rawItems)
      .map((file) => {
        const pendingItem = pendingItems.find((item) => item.file === file)
          || pendingItems.find((item) => (
            [item.file?.name || "", item.file?.size || 0, item.file?.lastModified || 0].join(":")
              === [file.name || "", file.size || 0, file.lastModified || 0].join(":")
          ));
        return { file, pendingItem };
      });
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
        const base = Math.floor((index / entries.length) * 100);
        const updateProgress = ({ percent }) => {
          const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
          const scaled = Math.min(100, Math.floor(((index + safePercent / 100) / entries.length) * 100));
          store.uploadProgress.value = Math.max(base, scaled);
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

  async function downloadFile(file, options = {}) {
    if (!file?.objectKey) {
      store.setComposerHint("附件已过期或下载地址不可用", "error");
      return;
    }
    const mode = options.mode === "saveAs" ? "saveAs" : "download";
    const openAfterSave = Boolean(options.openAfterSave);
    const silent = Boolean(options.silent);
    store.downloadingFile.value = true;
    store.downloadProgress.value = 0;
    store.downloadFileName.value = file.name || "attachment";
    store.setFileTransfer(file.objectKey, { status: "downloading", progress: 0, path: "", error: "" });
    try {
      const blob = await chatApi.getBlobWithProgress(
        `/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`,
        ({ percent }) => {
          store.downloadProgress.value = percent;
          store.setFileTransfer(file.objectKey, { status: "downloading", progress: percent });
        },
      );
      store.downloadProgress.value = 100;
      store.setFileTransfer(file.objectKey, { status: "saving", progress: 100 });
      if (window.desktopShell?.isDesktop && typeof window.desktopShell?.saveDownloadedFile === "function") {
        const saved = await window.desktopShell.saveDownloadedFile({
          fileName: file.name || "attachment",
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
          conversationId: store.selectedId.value || "shared",
          cacheKey: file.objectKey,
          saveAs: mode === "saveAs",
        });
        if (saved?.canceled) {
          store.setFileTransfer(file.objectKey, { status: "", progress: 0, path: "", error: "" });
          return;
        }
        if (!silent) {
          store.pushNotification({
            title: mode === "saveAs" ? "已另存为" : "已保存到本地",
            message: saved?.exportPath || file.name || "附件",
            tone: "success",
            ttl: 2600,
          });
        }
        store.setFileTransfer(file.objectKey, {
          status: "saved",
          progress: 100,
          path: saved?.exportPath || "",
          error: "",
        });
        if (openAfterSave && saved?.exportPath && typeof window.desktopShell?.openFile === "function") {
          await window.desktopShell.openFile(saved.exportPath).catch(() => {});
        }
      } else {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = file.name || "attachment";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
        if (!silent) {
          store.pushNotification({ title: "开始下载", message: file.name || "附件", tone: "success", ttl: 2200 });
        }
        store.setFileTransfer(file.objectKey, { status: "saved", progress: 100, path: file.name || "附件", error: "" });
      }
      appendAppLog({ level: "info", category: "file", message: `开始下载 ${file.name || "附件"}` });
    } catch (error) {
      store.setFileTransfer(file.objectKey, {
        status: "failed",
        progress: 0,
        error: error?.message || "下载失败",
      });
      throw error;
    } finally {
      window.setTimeout(() => {
        store.downloadingFile.value = false;
        store.downloadProgress.value = 0;
        store.downloadFileName.value = "";
      }, 600);
    }
  }

  async function autoReceiveImages(files = []) {
    const targets = files.filter((file) => (
      file?.isImage
      && file?.objectKey
      && !file?.expired
      && !autoReceiveQueue.has(String(file.objectKey))
      && !["saved", "saving", "downloading"].includes(String(file?.transfer?.status || ""))
    ));
    for (const file of targets) {
      const objectKey = String(file.objectKey);
      autoReceiveQueue.add(objectKey);
      try {
        await downloadFile(file, { silent: true });
      } catch {
      } finally {
        autoReceiveQueue.delete(objectKey);
      }
    }
  }

  async function openFileLocation(file) {
    const targetPath = String(file?.transfer?.path || "").trim();
    if (!targetPath) {
      store.setComposerHint("该文件还没有本地保存记录", "error");
      return;
    }
    if (typeof window.desktopShell?.openStoragePath !== "function") {
      store.setComposerHint("当前环境不支持打开文件位置", "error");
      return;
    }
    await window.desktopShell.openStoragePath(targetPath);
  }

  async function openFile(file) {
    const targetPath = String(file?.transfer?.path || "").trim();
    if (targetPath && typeof window.desktopShell?.openFile === "function") {
      const opened = await window.desktopShell.openFile(targetPath);
      if (!opened) throw new Error("文件打开失败");
      return;
    }
    await downloadFile(file, { openAfterSave: true });
  }

  async function saveFileAs(file) {
    await downloadFile(file, { mode: "saveAs" });
  }

  async function copyImageToClipboard(file) {
    if (!file?.objectKey || !isImageFileLike(file)) {
      store.setComposerHint("当前附件不是可复制的图片", "error");
      return;
    }
    const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`);
    if (typeof window.desktopShell?.writeImageToClipboard === "function") {
      await window.desktopShell.writeImageToClipboard({
        fileName: file.name || "image.png",
        mimeType: file.mimeType || blob.type || "image/png",
        bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
      });
      store.setComposerHint("图片已复制到剪贴板", "success");
      return;
    }
    if (navigator.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type || "image/png"]: blob })]);
      store.setComposerHint("图片已复制到剪贴板", "success");
      return;
    }
    throw new Error("当前环境不支持复制图片");
  }

  async function deleteMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState) return;
    const userId = store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
    const fallbackPreview = pickVisibleConversationPreview(store.messages.value, messageId);
    rememberLocallyDeletedMessage(userId, store.selectedId.value, messageId, fallbackPreview);
    removeMessageLocally(store, messageId);
    patchConversationLocally(store, store.selectedId.value, {
      lastMessage: fallbackPreview,
      updatedAt: fallbackPreview?.createdAt || new Date().toISOString(),
    });
    appendAppLog({ level: "info", category: "message", message: "消息已从当前账号删除" });
  }

  return {
    autoReceiveImages,
    copyImageToClipboard,
    deleteMessage,
    downloadFile,
    openFile,
    openFileLocation,
    retryMessage,
    saveFileAs,
    uploadFiles,
  };
}
