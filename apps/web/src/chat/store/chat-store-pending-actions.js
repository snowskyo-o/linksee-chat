import { revokePendingAttachment } from "../composables/file-attachments.js";

export function createChatStorePendingActions(state, setComposerHint) {
  function clearReplyState() {
    state.replyTo.value = null;
  }

  function resetComposer() {
    state.messageInput.value = "";
    state.mentionOpen.value = false;
    state.mentionOptions.value = [];
    state.uploadProgress.value = 0;
    state.uploadFileName.value = "";
    setComposerHint("", "");
    state.searchKeyword.value = "";
    state.messageKeyword.value = "";
  }

  function clearPendingFiles() {
    state.pendingFiles.value.forEach(revokePendingAttachment);
    state.pendingFiles.value = [];
  }

  function removePendingFile(id) {
    const target = state.pendingFiles.value.find((item) => item.id === id);
    revokePendingAttachment(target);
    state.pendingFiles.value = state.pendingFiles.value.filter((item) => item.id !== id);
  }

  function updatePendingFile(id, patch) {
    const targetId = String(id || "");
    if (!targetId) return;
    state.pendingFiles.value = state.pendingFiles.value.map((item) => (
      item.id === targetId
        ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
        : item
    ));
  }

  function removePendingFiles(ids = []) {
    const idSet = new Set(ids.map((id) => String(id || "")).filter(Boolean));
    state.pendingFiles.value.forEach((item) => {
      if (idSet.has(String(item.id || ""))) revokePendingAttachment(item);
    });
    state.pendingFiles.value = state.pendingFiles.value.filter((item) => !idSet.has(String(item.id || "")));
  }

  function setFileTransfer(objectKey, patch) {
    const key = String(objectKey || "");
    if (!key) return;
    state.fileTransfers.value = {
      ...state.fileTransfers.value,
      [key]: {
        ...(state.fileTransfers.value[key] || {}),
        ...patch,
      },
    };
  }

  return {
    clearPendingFiles,
    clearReplyState,
    removePendingFile,
    removePendingFiles,
    resetComposer,
    setFileTransfer,
    updatePendingFile,
  };
}
