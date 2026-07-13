import { ref } from "vue";
import {
  createImageViewerActiveFile,
  createImageViewerOwnerMessageId,
  createImageViewerStatusText,
} from "./chat-image-viewer-derived.js";
import { chatApi } from "../../shared/api-client.js";
import { createObjectUrlFromBlobLike } from "../../shared/blob-source.js";

export function useChatImageViewer({ store, actions }) {
  const imageViewerOpen = ref(false);
  const imageViewerTitle = ref("");
  const imageViewerSrc = ref("");
  const imageViewerLoading = ref(false);
  const imageViewerHint = ref("");
  const imageViewerFile = ref(null);
  const imageViewerMessageId = ref("");
  const imageViewerActiveFile = createImageViewerActiveFile(store, imageViewerFile);
  const imageViewerOwnerMessageId = createImageViewerOwnerMessageId(store, imageViewerActiveFile, imageViewerFile, imageViewerMessageId);
  const imageViewerStatusText = createImageViewerStatusText(imageViewerActiveFile, imageViewerHint, imageViewerLoading);

  async function openImageViewer(payload) {
    const file = payload?.file || payload;
    const messageId = String(payload?.messageId || "").trim();
    if (!file?.objectKey) return;
    imageViewerOpen.value = true;
    imageViewerTitle.value = file.name || "图片预览";
    imageViewerSrc.value = "";
    imageViewerHint.value = "";
    imageViewerLoading.value = true;
    imageViewerFile.value = file;
    imageViewerMessageId.value = messageId;
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
    imageViewerTitle.value = imageViewerSrc.value = imageViewerHint.value = imageViewerMessageId.value = "";
    imageViewerLoading.value = false;
    imageViewerFile.value = null;
  }

  return {
    closeImageViewer,
    copyImageFromViewer,
    forwardImageFromViewer,
    imageViewerActiveFile,
    imageViewerHint,
    imageViewerLoading,
    imageViewerOpen,
    imageViewerOwnerMessageId,
    imageViewerSrc,
    imageViewerStatusText,
    imageViewerTitle,
    openImageLocationFromViewer,
    openImageViewer,
    saveImageFromViewer,
  };
}
