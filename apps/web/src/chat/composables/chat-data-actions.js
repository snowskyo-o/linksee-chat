import { normalizeMessage, normalizeUser, patchConversationLocally } from "./message-operations.js";

export function createChatDataActions(store, chatApi) {
  async function loadProfile(auth) {
    const payload = await chatApi.getJson("/api/v1/users/me");
    store.me.value = normalizeUser(payload.data || {});
    store.profileName.value = store.me.value.profile?.realName || auth.userId;
    store.profileBio.value = store.me.value.profile?.bio || "";
    document.title = `Linksee Chat · ${store.profileName.value}`;
  }

  async function loadContacts() {
    const payload = await chatApi.getJson("/api/v1/contacts");
    store.contacts.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeUser);
  }

  async function loadConversations() {
    const payload = await chatApi.getJson("/api/v1/conversations");
    store.conversations.value = Array.isArray(payload.data) ? payload.data : [];
    if (!store.selectedId.value && store.conversations.value.length) {
      store.selectedId.value = store.conversations.value[0].id;
    }
    if (store.selectedId.value && !store.conversations.value.find((item) => item.id === store.selectedId.value)) {
      store.selectedId.value = store.conversations.value[0]?.id || "";
    }
  }

  async function loadParticipants() {
    if (!store.selectedId.value) {
      store.participants.value = [];
      return;
    }
    const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/participants`);
    store.participants.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeUser);
  }

  async function loadMessages() {
    if (!store.selectedId.value) {
      store.messages.value = [];
      store.hasMoreMessages.value = false;
      return;
    }
    const path = store.searchKeyword.value
      ? `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/search?q=${encodeURIComponent(store.searchKeyword.value)}`
      : `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?limit=50`;
    const payload = await chatApi.getJson(path);
    store.messages.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeMessage);
    store.hasMoreMessages.value = !store.searchKeyword.value && store.messages.value.length >= 50;
  }

  async function loadOlderMessages() {
    if (!store.selectedId.value || store.searchKeyword.value || !store.messages.value.length) return;
    const oldest = store.messages.value[0];
    if (!oldest?.id) return;
    store.loadingMoreMessages.value = true;
    try {
      const payload = await chatApi.getJson(
        `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?beforeId=${encodeURIComponent(oldest.id)}&limit=50`,
      );
      const older = (Array.isArray(payload.data) ? payload.data : []).map(normalizeMessage);
      store.messages.value = [...older, ...store.messages.value];
      store.hasMoreMessages.value = older.length >= 50;
    } finally {
      store.loadingMoreMessages.value = false;
    }
  }

  async function refreshSelectedConversation() {
    await loadParticipants();
    await loadMessages();
  }

  async function refreshAll() {
    await loadContacts();
    await loadConversations();
    await refreshSelectedConversation();
  }

  async function markConversationReadIfNeeded() {
    const selected = store.selectedConversation.value;
    const lastMessage = store.messages.value[store.messages.value.length - 1];
    if (!selected || !lastMessage?.id) return;
    if (!selected.unreadCount && !selected.unreadMentionCount) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/read`, {
      messageId: lastMessage.id,
    });
    patchConversationLocally(store, selected.id, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
  }

  async function selectConversation(id) {
    store.selectedId.value = id;
    store.searchKeyword.value = "";
    store.messageKeyword.value = "";
    store.clearReplyState();
    await refreshSelectedConversation();
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
    selectConversation,
    searchMessages,
  };
}
