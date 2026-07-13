export function useChatComposerMediaControls({ store, actions }) {
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
    clearMessageSearch,
    handleComposerKeydown,
    handleFileChange,
    handleFileDrop,
    handleFilePaste,
    openFilePicker,
  };
}
