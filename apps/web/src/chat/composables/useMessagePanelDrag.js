import { onBeforeUnmount, onMounted, ref } from "vue";

export function useMessagePanelDrag(workspaceRef, emit) {
  const dragActive = ref(false);

  function isFileDrag(event) {
    return event.dataTransfer?.types?.includes("Files");
  }

  function isPointInsideWorkspace(clientX, clientY) {
    const element = workspaceRef.value;
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  function resetDragState() {
    dragActive.value = false;
  }

  function handleDragEnter(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragActive.value = isPointInsideWorkspace(event.clientX, event.clientY);
  }

  function handleDragOver(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dragActive.value = isPointInsideWorkspace(event.clientX, event.clientY);
  }

  function handleDragLeave(event) {
    if (!isFileDrag(event) || isPointInsideWorkspace(event.clientX, event.clientY)) return;
    resetDragState();
  }

  function handleDrop(event) {
    if (!event.dataTransfer?.files?.length && !event.dataTransfer?.items?.length) return;
    event.preventDefault();
    resetDragState();
    const items = Array.from(event.dataTransfer?.items || []);
    const directoryLike = items.filter((item) => item.kind === "file" && typeof item.webkitGetAsEntry === "function" && item.webkitGetAsEntry()?.isDirectory).length;
    emit("file-drop", { files: event.dataTransfer.files, directoryLike });
  }

  function handleWindowDragOver(event) {
    if (!dragActive.value || !isFileDrag(event) || isPointInsideWorkspace(event.clientX, event.clientY)) return;
    resetDragState();
  }

  function handleWindowDragEnd() {
    resetDragState();
  }

  onMounted(() => {
    window.addEventListener("dragover", handleWindowDragOver);
    window.addEventListener("drop", handleWindowDragEnd);
    window.addEventListener("dragend", handleWindowDragEnd);
    window.addEventListener("blur", handleWindowDragEnd);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("dragover", handleWindowDragOver);
    window.removeEventListener("drop", handleWindowDragEnd);
    window.removeEventListener("dragend", handleWindowDragEnd);
    window.removeEventListener("blur", handleWindowDragEnd);
  });

  return {
    dragActive,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
  };
}
