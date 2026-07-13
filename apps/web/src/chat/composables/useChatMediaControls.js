import { computed, ref } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { createObjectUrlFromBlobLike } from "../../shared/blob-source.js";

export function useChatMediaControls({ store, actions, stickerLibrary, appInfo }) {
  const stickerImportOpen = ref(false);
  const imageViewerOpen = ref(false);
  const imageViewerTitle = ref("");
  const imageViewerSrc = ref("");
  const imageViewerLoading = ref(false);
  const imageViewerHint = ref("");
  const imageViewerFile = ref(null);

  const imageViewerActiveFile = computed(() => {
    const objectKey = String(imageViewerFile.value?.objectKey || "").trim();
    if (!objectKey) return imageViewerFile.value;
    for (const message of store.renderedMessages.value) {
      const matched = (message.files || []).find((file) => String(file.objectKey || "") === objectKey);
      if (matched) return matched;
    }
    return imageViewerFile.value;
  });

  const imageViewerOwnerMessageId = computed(() => {
    const objectKey = String(imageViewerActiveFile.value?.objectKey || imageViewerFile.value?.objectKey || "").trim();
    if (!objectKey) return "";
    const owner = store.renderedMessages.value.find((message) => (
      Array.isArray(message.files) && message.files.some((file) => String(file.objectKey || "") === objectKey)
    ));
    return String(owner?.id || "");
  });

  const imageViewerStatusText = computed(() => {
    const transfer = imageViewerActiveFile.value?.transfer || null;
    if (imageViewerLoading.value) return "正在加载";
    if (transfer?.status === "downloading") return `下载中 ${transfer.progress || 0}%`;
    if (transfer?.status === "saving") return "正在保存到本地";
    if (transfer?.status === "saved") return transfer.path ? "已保存，可打开位置" : "已保存";
    if (transfer?.status === "failed") return transfer.error || "保存失败";
    return imageViewerHint.value || "";
  });

  function closeStickerImport() {
    stickerImportOpen.value = false;
  }

  function clearMessageSearch() {
    store.messageKeyword.value = "";
    store.searchKeyword.value = "";
    actions.refreshSelectedConversation().catch(() => {});
  }

  function cancelEdit() {
    store.clearReplyState();
    store.messageInput.value = "";
    store.mentionOpen.value = false;
    store.mentionOptions.value = [];
  }

  function openFilePicker() {
    const input = document.querySelector(".composer input[type='file']");
    if (!input) return;
    input.value = "";
    input.click();
  }

  function handleFileChange(event) {
    actions.queueFiles(event.target?.files || [], { source: "picker" });
  }

  function handleFileDrop(payload) {
    actions.queueFiles(payload?.files || payload || [], {
      source: "drop",
      directoryLike: Number(payload?.directoryLike || 0),
    });
  }

  function handleFilePaste(payload) {
    actions.queueFiles(payload?.files || payload || [], {
      source: "paste",
      ignoredClipboardFiles: Number(payload?.ignoredClipboardFiles || 0),
    });
  }

  function openStickerImport() {
    stickerImportOpen.value = true;
  }

  async function importStickerFiles() {
    await stickerLibrary.importFiles();
  }

  async function importStickerFolder() {
    await stickerLibrary.importFolder();
  }

  async function renameSticker(payload) {
    await stickerLibrary.rename(payload?.id, payload?.name);
  }

  async function deleteSticker(stickerId) {
    await stickerLibrary.remove(stickerId);
  }

  async function moveSticker(payload) {
    await stickerLibrary.move(payload?.id, payload?.direction);
  }

  async function openStickerFolder() {
    const folder = appInfo.value.storage?.stickers || "";
    if (!folder || typeof window.desktopShell?.openStoragePath !== "function") return;
    await window.desktopShell.openStoragePath(folder).catch(() => {});
  }

  async function handleSendSticker(sticker) {
    const source = sticker?.originalSrc || sticker?.src || "";
    if (!source) return;
    stickerLibrary.markUsed(sticker);
    try {
      const response = await fetch(source);
      const blob = await response.blob();
      const extension = blob.type === "image/gif"
        ? "gif"
        : blob.type === "image/webp"
          ? "webp"
          : blob.type === "image/jpeg"
            ? "jpg"
            : "png";
      const file = new File([blob], `${sticker.name || "sticker"}.${extension}`, {
        type: blob.type || "image/png",
        lastModified: Date.now(),
      });
      await actions.uploadFiles([file]);
      stickerLibrary.clearHint();
    } catch (error) {
      store.setComposerHint(error?.message || "表情发送失败", "error");
    }
  }

  async function captureScreenshot() {
    if (typeof window.desktopShell?.captureScreenshot !== "function") {
      store.setComposerHint("当前环境不支持截图发送", "error");
      return;
    }
    try {
      const payload = await window.desktopShell.captureScreenshot();
      if (payload?.canceled) return;
      const bytes = new Uint8Array(Array.isArray(payload?.bytes) ? payload.bytes : []);
      if (!bytes.length) throw new Error("截图结果为空");
      const file = new File([bytes], payload?.fileName || `截图-${Date.now()}.png`, {
        type: payload?.mimeType || "image/png",
        lastModified: Date.now(),
      });
      await actions.uploadFiles([file]);
    } catch (error) {
      store.setComposerHint(error?.message || "截图发送失败", "error");
    }
  }

  async function openImageViewer(file) {
    if (!file?.objectKey) return;
    imageViewerOpen.value = true;
    imageViewerTitle.value = file.name || "图片预览";
    imageViewerSrc.value = "";
    imageViewerHint.value = "";
    imageViewerLoading.value = true;
    imageViewerFile.value = file;
    try {
      const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`);
      imageViewerSrc.value = await createObjectUrlFromBlobLike(blob, file.mimeType || "image/png");
    } catch (error) {
      imageViewerHint.value = error?.message || "图片加载失败";
    } finally {
      imageViewerLoading.value = false;
    }
  }

  function forwardImageFromViewer() {
    if (!imageViewerOwnerMessageId.value) {
      store.setComposerHint("当前图片暂时无法转发", "error");
      return;
    }
    store.openForwardDialog(imageViewerOwnerMessageId.value);
  }

  function withViewerFile(task, fallbackMessage) {
    const file = imageViewerActiveFile.value;
    if (!file) {
      store.setComposerHint(fallbackMessage, "error");
      return Promise.resolve();
    }
    return Promise.resolve(task(file)).catch((error) => {
      store.setComposerHint(error?.message || fallbackMessage, "error");
    });
  }

  function saveImageFromViewer() {
    return withViewerFile((file) => actions.downloadFile(file), "保存图片失败");
  }

  function copyImageFromViewer() {
    return withViewerFile((file) => actions.copyImageToClipboard(file), "复制图片失败");
  }

  function openImageLocationFromViewer() {
    return withViewerFile((file) => actions.openFileLocation(file), "打开文件位置失败");
  }

  function closeImageViewer() {
    if (imageViewerSrc.value.startsWith("blob:")) window.URL.revokeObjectURL(imageViewerSrc.value);
    imageViewerOpen.value = false;
    imageViewerTitle.value = "";
    imageViewerSrc.value = "";
    imageViewerHint.value = "";
    imageViewerLoading.value = false;
    imageViewerFile.value = null;
  }

  function handleComposerKeydown(event, appSettings) {
    const shortcut = appSettings.value.general?.sendShortcut || "enter";
    if (event.key === "Escape") {
      store.mentionOpen.value = false;
      store.mentionOptions.value = [];
    }
    const shouldSend = event.key === "Enter" && (shortcut === "ctrlEnter" ? event.ctrlKey : !event.shiftKey);
    if (shouldSend) {
      event.preventDefault();
      actions.submitComposer().catch((error) => {
        store.setComposerHint(error?.message || "发送失败", "error");
      });
      return;
    }
    store.updateMentionState();
  }

  return {
    cancelEdit,
    captureScreenshot,
    clearMessageSearch,
    closeImageViewer,
    closeStickerImport,
    copyImageFromViewer,
    deleteSticker,
    forwardImageFromViewer,
    handleComposerKeydown,
    handleFileChange,
    handleFileDrop,
    handleFilePaste,
    handleSendSticker,
    imageViewerActiveFile,
    imageViewerHint,
    imageViewerLoading,
    imageViewerOpen,
    imageViewerOwnerMessageId,
    imageViewerSrc,
    imageViewerStatusText,
    imageViewerTitle,
    importStickerFiles,
    importStickerFolder,
    moveSticker,
    openFilePicker,
    openImageLocationFromViewer,
    openImageViewer,
    openStickerFolder,
    openStickerImport,
    renameSticker,
    saveImageFromViewer,
    stickerImportOpen,
  };
}
