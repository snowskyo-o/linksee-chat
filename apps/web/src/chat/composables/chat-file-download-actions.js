import { appendAppLog } from "../../shared/app-log.js";
import { chatApi } from "../../shared/api-client.js";
import { isImageFileLike } from "./file-attachments.js";

export function createChatFileDownloadActions({ store, autoReceiveQueue }) {
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

  return {
    autoReceiveImages,
    copyImageToClipboard,
    downloadFile,
    openFile,
    openFileLocation,
    saveFileAs,
  };
}
