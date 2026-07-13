import { normalizeMessage, normalizeUser, patchConversationLocally } from "./message-operations.js";
import { readChatCache, writeChatCache } from "./local-chat-cache.js";

export function createChatDataActions(store, chatApi) {
  const cacheUserId = () => store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
  const getDraftCacheKey = (conversationId) => `draft-${conversationId}`;

  async function saveConversationDraft(conversationId, draft = "") {
    const targetId = String(conversationId || "").trim();
    if (!targetId) return;
    await writeChatCache(cacheUserId(), getDraftCacheKey(targetId), {
      data: {
        text: String(draft || ""),
      },
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  async function loadConversationDraft(conversationId) {
    const targetId = String(conversationId || "").trim();
    if (!targetId) return "";
    const cached = await readChatCache(cacheUserId(), getDraftCacheKey(targetId));
    return String(cached?.data?.text || "");
  }

  async function loadProfile(auth) {
    const cached = await readChatCache(cacheUserId(), "profile");
    if (cached?.data) {
      store.me.value = normalizeUser(cached.data || {});
      store.profileName.value = store.me.value.profile?.realName || auth.userId;
      store.profileBio.value = store.me.value.profile?.bio || "";
      document.title = `Linksee Chat · ${store.profileName.value}`;
    }
    const payload = await chatApi.getJson("/api/v1/users/me");
    store.me.value = normalizeUser(payload.data || {});
    store.profileName.value = store.me.value.profile?.realName || auth.userId;
    store.profileBio.value = store.me.value.profile?.bio || "";
    document.title = `Linksee Chat · ${store.profileName.value}`;
    writeChatCache(cacheUserId(), "profile", { data: payload.data || {}, cachedAt: new Date().toISOString() }).catch(() => {});
  }

  async function loadContacts() {
    const cached = await readChatCache(cacheUserId(), "contacts");
    if (Array.isArray(cached?.data) && cached.data.length && !store.contacts.value.length) {
      store.contacts.value = cached.data.map(normalizeUser);
    }
    const payload = await chatApi.getJson("/api/v1/contacts");
    store.contacts.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeUser);
    writeChatCache(cacheUserId(), "contacts", { data: payload.data || [], cachedAt: new Date().toISOString() }).catch(() => {});
  }

  async function loadConversations() {
    const cached = await readChatCache(cacheUserId(), "conversations");
    if (Array.isArray(cached?.data) && cached.data.length && !store.conversations.value.length) {
      store.conversations.value = cached.data;
    }
    const payload = await chatApi.getJson("/api/v1/conversations");
    store.conversations.value = Array.isArray(payload.data) ? payload.data : [];
    writeChatCache(cacheUserId(), "conversations", { data: store.conversations.value, cachedAt: new Date().toISOString() }).catch(() => {});
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
    const cached = await readChatCache(cacheUserId(), `participants-${store.selectedId.value}`);
    if (Array.isArray(cached?.data) && cached.data.length && !store.participants.value.length) {
      store.participants.value = cached.data.map(normalizeUser);
    }
    const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/participants`);
    store.participants.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeUser);
    writeChatCache(cacheUserId(), `participants-${store.selectedId.value}`, {
      data: payload.data || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
  }

  async function loadMessages() {
    if (!store.selectedId.value) {
      store.messages.value = [];
      store.hasMoreMessages.value = false;
      return;
    }
    const canUseCache = !store.searchKeyword.value;
    if (canUseCache) {
      const cached = await readChatCache(cacheUserId(), `messages-${store.selectedId.value}`);
      if (Array.isArray(cached?.data) && cached.data.length && !store.messages.value.length) {
        store.messages.value = cached.data.map(normalizeMessage);
        store.hasMoreMessages.value = Boolean(cached?.hasMoreMessages);
      }
    }
    const path = store.searchKeyword.value
      ? `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/search?q=${encodeURIComponent(store.searchKeyword.value)}`
      : `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?limit=50`;
    const payload = await chatApi.getJson(path);
    store.messages.value = (Array.isArray(payload.data) ? payload.data : []).map(normalizeMessage);
    store.hasMoreMessages.value = !store.searchKeyword.value && store.messages.value.length >= 50;
    if (!store.searchKeyword.value) {
      writeChatCache(cacheUserId(), `messages-${store.selectedId.value}`, {
        data: payload.data || [],
        hasMoreMessages: store.hasMoreMessages.value,
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
    }
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
      writeChatCache(cacheUserId(), `messages-${store.selectedId.value}`, {
        data: store.messages.value,
        hasMoreMessages: store.hasMoreMessages.value,
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
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
    const previousId = String(store.selectedId.value || "").trim();
    if (previousId) {
      await saveConversationDraft(previousId, store.messageInput.value);
    }
    store.selectedId.value = id;
    store.searchKeyword.value = "";
    store.messageKeyword.value = "";
    store.participants.value = [];
    store.messages.value = [];
    store.hasMoreMessages.value = false;
    store.clearReplyState();
    store.messageInput.value = "";
    await refreshSelectedConversation();
    store.messageInput.value = await loadConversationDraft(id);
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
