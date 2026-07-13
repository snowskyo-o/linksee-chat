export function createConversationListRuntimeHandlers({
  actions,
  derivedState,
  openChatWindow,
  store,
}) {
  async function handleRealtimeEvent(event) {
    const topic = String(event?.topic || "");
    if (!topic || topic === "socket.ready") return;
    if (topic === "user.profile.dirty") {
      actions.markProfileDirty(event.payload?.userId);
      return;
    }
    if (topic.startsWith("conversation.")) actions.loadConversations().catch(() => {});
  }

  async function openConversation(id) {
    store.showConversation(id);
    store.selectedId.value = id;
    const conversation = store.conversations.value.find((item) => String(item.id) === String(id));
    await actions.refreshProfilesIfDirty((conversation?.participants || []).map((user) => user.id)).catch(() => {});
    await openChatWindow(id);
  }

  async function handleDesktopOpenConversation(payload = {}) {
    const conversationId = String(payload.conversationId || "").trim();
    if (!conversationId) return;
    derivedState.activePane.value = "messages";
    await actions.loadConversations().catch(() => {});
    store.showConversation(conversationId);
    store.selectedId.value = conversationId;
  }

  function handleGlobalPointer(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".qq-list-search-cluster") || target.closest(".qq-search-panel") || target.closest(".qq-plus-action-wrap") || target.closest(".qq-quick-create-menu") || target.closest(".new-friends-dialog-card")) return;
    derivedState.searchFocused.value = false;
    derivedState.quickCreateOpen.value = false;
  }

  return {
    handleDesktopOpenConversation,
    handleGlobalPointer,
    handleRealtimeEvent,
    openConversation,
  };
}
