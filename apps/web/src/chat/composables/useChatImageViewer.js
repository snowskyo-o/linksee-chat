import { computed, ref } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { createObjectUrlFromBlobLike } from "../../shared/blob-source.js";

export function useChatImageViewer({ store, actions }) {
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
