import { isMessageActionAvailable } from "./chat-message-action-rules.js";

export function buildBaseMessageItems(message) {
  const items = [];
  if (isMessageActionAvailable(message, "copy")) items.push({ key: "copy", label: "复制" });
  if (isMessageActionAvailable(message, "reply")) items.push({ key: "reply", label: "回复" });
  if (isMessageActionAvailable(message, "forward")) items.push({ key: "forward", label: "转发" });
  if (isMessageActionAvailable(message, "favorite")) items.push({ key: "favorite", label: message.isFavorite ? "取消收藏" : "收藏" });
  if (isMessageActionAvailable(message, "recall")) items.push({ key: "recall", label: "撤回", tone: "danger" });
  if (isMessageActionAvailable(message, "delete")) items.push({ key: "delete", label: "删除", tone: "danger" });
  if (isMessageActionAvailable(message, "retry")) items.push({ key: "retry", label: "重试发送" });
  return items;
}

export function buildImageMenuItems(message) {
  return message.files.flatMap((file, index) => {
    if (!file.isImage) return [];
    const items = [
      { key: `open-image:${index}`, label: `查看 ${file.name}`, meta: file.metaText, disabled: file.expired, file, action: "open-image" },
      {
        key: `download-file:${index}`,
        label: `${file.transfer?.status === "saved" ? "打开" : file.transfer?.status === "failed" ? "重试保存" : "保存"} ${file.name}`,
        meta: file.expiryText || file.metaText,
        disabled: file.expired,
        file,
        action: file.transfer?.status === "saved" && file.transfer?.path ? "open-file" : "download-file",
      },
      { key: `copy-image:${index}`, label: `复制 ${file.name}`, meta: file.metaText, disabled: file.expired, file, action: "copy-image" },
    ];
    if (file.transfer?.status === "saved" && file.transfer?.path) {
      items.push({ key: `open-location:${index}`, label: `打开 ${file.name} 所在位置`, meta: file.transfer.path, disabled: false, file, action: "open-location" });
    }
    return items;
  });
}

export function buildFileMenuItems(message) {
  return message.files
    .filter((file) => !file.isImage)
    .flatMap((file, index) => {
      const items = [];
      if (file.transfer?.status === "saved" && file.transfer?.path) {
        items.push({ key: `open-file:${index}`, label: `打开 ${file.name}`, meta: file.transfer.path, disabled: false, file, action: "open-file" });
      }
      items.push({ key: `save-as:${index}`, label: file.expired ? `${file.name} 已过期` : `另存为 ${file.name}`, meta: file.expiryText, disabled: file.expired, file, action: "save-as" });
      if (file.transfer?.status === "saved" && file.transfer?.path) {
        items.push({ key: `open-location:${index}`, label: `打开 ${file.name} 所在位置`, meta: file.transfer.path, disabled: false, file, action: "open-location" });
      }
      return items;
    });
}
