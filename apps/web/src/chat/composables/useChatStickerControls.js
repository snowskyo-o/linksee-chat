import { ref } from "vue";

function resolveStickerExtension(blob) {
  if (blob.type === "image/gif") return "gif";
  if (blob.type === "image/webp") return "webp";
  if (blob.type === "image/jpeg") return "jpg";
  return "png";
}

export function useChatStickerControls({ store, actions, stickerLibrary, appInfo }) {
  const stickerImportOpen = ref(false);

  function closeStickerImport() {
    stickerImportOpen.value = false;
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
      const file = new File([blob], `${sticker.name || "sticker"}.${resolveStickerExtension(blob)}`, {
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

  return {
    captureScreenshot,
    closeStickerImport,
    deleteSticker,
    handleSendSticker,
    importStickerFiles,
    importStickerFolder,
    moveSticker,
    openStickerFolder,
    openStickerImport,
    renameSticker,
    stickerImportOpen,
  };
}
