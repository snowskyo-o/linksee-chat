import { computed, onBeforeUnmount, ref } from "vue";

export function useMessagePanelContextMenu(emit) {
  const messageMenu = ref({
    open: false,
    x: 0,
    y: 0,
    message: null,
  });

  const contextMenuItems = computed(() => {
    const message = messageMenu.value.message;
    if (!message) return [];
    const items = [{ key: "reply", label: "回复" }];
    if (message.canCopy) items.push({ key: "copy", label: "复制" });
    if (message.canForward) items.push({ key: "forward", label: "转发" });
    items.push({ key: "favorite", label: message.isFavorite ? "取消收藏" : "收藏" });
    if (message.canRecall) items.push({ key: "recall", label: "撤回", tone: "danger" });
    if (message.canDelete) items.push({ key: "delete", label: "删除", tone: "danger" });
    if (message.canRetry) items.push({ key: "retry", label: "重试发送" });
    if (!message.isFileMessage) return items;
    message.files
      .filter((file) => file.transfer?.status === "saved" && file.transfer?.path)
      .forEach((file, index) => items.push({ key: `open-file:${index}`, label: `打开 ${file.name}`, meta: file.transfer?.path || "", disabled: !file.transfer?.path, file, action: "open-file" }));
    message.files.forEach((file, index) => items.push({ key: `save-as:${index}`, label: file.expired ? `${file.name} 已过期` : `另存为 ${file.name}`, meta: file.expiryText, disabled: file.expired, file, action: "save-as" }));
    message.files
      .filter((file) => file.isImage && !file.expired && file.objectKey)
      .forEach((file, index) => items.push({ key: `copy-image:${index}`, label: `复制 ${file.name}`, meta: file.metaText, disabled: false, file, action: "copy-image" }));
    message.files
      .filter((file) => file.transfer?.status === "saved" && file.transfer?.path)
      .forEach((file, index) => items.push({ key: `open-location:${index}`, label: `打开 ${file.name} 所在位置`, meta: file.transfer?.path || "", disabled: !file.transfer?.path, file, action: "open-location" }));
    return items;
  });

  function closeFloatingPanels() {
    messageMenu.value = { open: false, x: 0, y: 0, message: null };
  }

  function openMessageMenu(payload) {
    const nextX = Math.min(payload.event.clientX, window.innerWidth - 220);
    const nextY = Math.min(payload.event.clientY, window.innerHeight - 260);
    messageMenu.value = { open: true, x: Math.max(12, nextX), y: Math.max(12, nextY), message: payload.message };
  }

  function selectContextItem(item) {
    if (item.disabled) return;
    if (item.file) {
      if (item.action === "copy-image") emit("copy-image", item.file);
      else if (item.action === "open-file") emit("open-file", item.file);
      else if (item.action === "open-location") emit("open-file-location", item.file);
      else emit("save-file-as", item.file);
      closeFloatingPanels();
      return;
    }
    emit("message-action", { id: messageMenu.value.message?.id, action: item.key });
    closeFloatingPanels();
  }

  function handleGlobalPointer(event) {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest(".message-context-menu")) return;
    closeFloatingPanels();
  }

  function handleGlobalKeydown(event) {
    if (event.key === "Escape") closeFloatingPanels();
  }

  window.addEventListener("pointerdown", handleGlobalPointer);
  window.addEventListener("keydown", handleGlobalKeydown);

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleGlobalPointer);
    window.removeEventListener("keydown", handleGlobalKeydown);
  });

  return {
    contextMenuItems,
    messageMenu,
    openMessageMenu,
    selectContextItem,
  };
}
