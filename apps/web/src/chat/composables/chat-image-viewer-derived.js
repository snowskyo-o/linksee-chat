import { computed } from "vue";

function findFileByObjectKey(messages, fallbackFile, objectKey) {
  if (!objectKey) return fallbackFile;
  for (const message of messages) {
    const matched = (message.files || []).find((file) => String(file.objectKey || "") === objectKey);
    if (matched) return matched;
  }
  return fallbackFile;
}

export function createImageViewerActiveFile(store, imageViewerFile) {
  return computed(() => {
    const objectKey = String(imageViewerFile.value?.objectKey || "").trim();
    return findFileByObjectKey(store.renderedMessages.value, imageViewerFile.value, objectKey);
  });
}

export function createImageViewerOwnerMessageId(store, imageViewerActiveFile, imageViewerFile) {
  return computed(() => {
    const objectKey = String(imageViewerActiveFile.value?.objectKey || imageViewerFile.value?.objectKey || "").trim();
    if (!objectKey) return "";
    const owner = store.renderedMessages.value.find((message) => Array.isArray(message.files) && message.files.some((file) => String(file.objectKey || "") === objectKey));
    return String(owner?.id || "");
  });
}

export function createImageViewerStatusText(imageViewerActiveFile, imageViewerHint, imageViewerLoading) {
  return computed(() => {
    const transfer = imageViewerActiveFile.value?.transfer || null;
    if (imageViewerLoading.value) return "正在加载";
    if (transfer?.status === "downloading") return `下载中 ${transfer.progress || 0}%`;
    if (transfer?.status === "saving") return "正在保存到本地";
    if (transfer?.status === "saved") return transfer.path ? "已保存，可打开位置" : "已保存";
    if (transfer?.status === "failed") return transfer.error || "保存失败";
    return imageViewerHint.value || "";
  });
}
