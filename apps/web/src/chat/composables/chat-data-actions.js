import { createChatDraftActions } from "./chat-draft-actions.js";
import { createChatLoadActions } from "./chat-load-actions.js";

export function createChatDataActions(store, chatApi) {
  const cacheUserId = () => store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
  const setLoadState = (target, status, message = "") => {
    target.value = { status, message };
  };
  const { loadConversationDraft, saveConversationDraft } = createChatDraftActions({ cacheUserId });
  const {
    loadContacts,
    loadConversations,
    loadMessages,
    loadOlderMessages,
    loadParticipants,
    loadProfile,
    markConversationReadIfNeeded,
    refreshAll,
    refreshSelectedConversation,
  } = createChatLoadActions({ store, chatApi, cacheUserId, setLoadState });

  async function selectConversation(id) {
    const previousId = String(store.selectedId.value || "").trim();
    if (previousId) {
      await saveConversationDraft(previousId, store.messageInput.value, store.pendingFiles.value);
    }
    store.selectedId.value = id;
    store.searchKeyword.value = "";
    store.messageKeyword.value = "";
    store.participants.value = [];
    store.messages.value = [];
    store.hasMoreMessages.value = false;
    store.clearReplyState();
    store.messageInput.value = "";
    store.clearPendingFiles();
    await refreshSelectedConversation();
    const draft = await loadConversationDraft(id);
    store.messageInput.value = draft.text || "";
    store.pendingFiles.value = Array.isArray(draft.files) ? draft.files : [];
    store.updateMentionState(store.messageInput.value);
    await markConversationReadIfNeeded().catch(() => {});
  }

  async function searchMessages() {
    store.searchKeyword.value = store.messageKeyword.value.trim();
    await loadMessages();
  }

  return {
    loadProfile,
    loadContacts,
    loadConversations,
    loadParticipants,
    loadMessages,
    loadOlderMessages,
    refreshSelectedConversation,
    refreshAll,
    markConversationReadIfNeeded,
    saveConversationDraft,
    loadConversationDraft,
    selectConversation,
    searchMessages,
  };
}
