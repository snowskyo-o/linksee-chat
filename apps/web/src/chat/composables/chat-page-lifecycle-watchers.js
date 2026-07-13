import { watch } from "vue";

export function useChatPageLifecycleWatchers({
  actions,
  desktopControls,
  realtimeRuntime,
  store,
  syncDesktopWindowContext,
}) {
  let draftPersistTimer = null;

  function scheduleDraftPersist(conversationId, messageInput) {
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (!conversationId) return;
    draftPersistTimer = window.setTimeout(() => {
      actions.saveConversationDraft(conversationId, messageInput, store.pendingFiles.value).catch(() => {});
      draftPersistTimer = null;
    }, 240);
  }

  watch(() => store.selectedId.value, syncDesktopWindowContext);
  watch(() => store.socketOnline.value, (online, previousOnline) => {
    realtimeRuntime.handleSocketOnlineChange(online, previousOnline);
  });
  watch(realtimeRuntime.unreadTotal, (value) => {
    window.desktopShell?.updateUnreadCount?.(value).catch?.(() => {});
  }, { immediate: true });
  watch(() => [store.selectedId.value, store.messageInput.value], ([conversationId, messageInput]) => {
    scheduleDraftPersist(conversationId, messageInput);
  });
  watch(() => [store.selectedId.value, store.pendingFiles.value.map((item) => `${item.name}:${item.size}:${item.lastModified}`).join("|")], ([conversationId]) => {
    scheduleDraftPersist(conversationId, store.messageInput.value);
  });
  watch(() => [desktopControls.appSettings.value.files?.autoReceiveImages, store.renderedMessages.value.map((message) => message.id).join("|")], ([enabled]) => {
    if (!enabled || !window.desktopShell?.isDesktop) return;
    const imageFiles = store.renderedMessages.value.flatMap((message) => message.files || []).filter((file) => file?.isImage);
    actions.autoReceiveImages?.(imageFiles).catch?.(() => {});
  }, { immediate: true });

  return {
    clearDraftPersistTimer() {
      if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    },
  };
}
