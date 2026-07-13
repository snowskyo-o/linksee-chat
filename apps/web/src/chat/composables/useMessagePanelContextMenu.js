import { computed, onBeforeUnmount, ref } from "vue";
import { buildBaseMessageItems, buildFileMenuItems, buildImageMenuItems } from "./message-context-menu-items.js";

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
    const items = buildBaseMessageItems(message);
    if (!message.isFileMessage) return items;
    items.push(...buildImageMenuItems(message));
    items.push(...buildFileMenuItems(message));
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
      else if (item.action === "download-file") emit("download-file", item.file);
      else if (item.action === "open-image") emit("open-image", item.file);
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
