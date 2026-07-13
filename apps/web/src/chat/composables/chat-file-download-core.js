import { appendAppLog } from "../../shared/app-log.js";
import { chatApi } from "../../shared/api-client.js";

function resetDownloadState(store) {
  window.setTimeout(() => {
    store.downloadingFile.value = false;
    store.downloadProgress.value = 0;
    store.downloadFileName.value = "";
  }, 600);
}

async function saveBlobToDesktop(store, file, blob, mode, silent, openAfterSave) {
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
  store.setFileTransfer(file.objectKey, { status: "saved", progress: 100, path: saved?.exportPath || "", error: "" });
  if (openAfterSave && saved?.exportPath && typeof window.desktopShell?.openFile === "function") {
    await window.desktopShell.openFile(saved.exportPath).catch(() => {});
  }
}

function saveBlobToBrowser(store, file, blob, silent) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name || "attachment";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  if (!silent) store.pushNotification({ title: "开始下载", message: file.name || "附件", tone: "success", ttl: 2200 });
  store.setFileTransfer(file.objectKey, { status: "saved", progress: 100, path: file.name || "附件", error: "" });
}

export function createChatFileDownloadCore({ store }) {
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
        await saveBlobToDesktop(store, file, blob, mode, silent, openAfterSave);
      } else {
        saveBlobToBrowser(store, file, blob, silent);
      }
      appendAppLog({ level: "info", category: "file", message: `开始下载 ${file.name || "附件"}` });
    } catch (error) {
      store.setFileTransfer(file.objectKey, { status: "failed", progress: 0, error: error?.message || "下载失败" });
      throw error;
    } finally {
      resetDownloadState(store);
    }
  }

  return {
    downloadFile,
  };
}
