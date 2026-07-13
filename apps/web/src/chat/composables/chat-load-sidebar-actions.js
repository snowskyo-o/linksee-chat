import { readChatCache, writeChatCache } from "./local-chat-cache.js";
import { normalizeUser } from "./message-operations.js";
import { applyLocalConversationVisibility } from "./message-visibility-cache.js";
import { mergeUsersById } from "./chat-profile-merge.js";
import { mergeConversationsById } from "./chat-profile-merge-conversations.js";

export function createChatLoadSidebarActions({ store, chatApi, cacheUserId, setLoadState }) {
  async function loadContacts() {
    const cached = await readChatCache(cacheUserId(), "contacts");
    if (Array.isArray(cached?.data) && cached.data.length && !store.contacts.value.length) {
      store.contacts.value = cached.data.map(normalizeUser);
    }
    const payload = await chatApi.getJson("/api/v1/contacts");
    const mergedContacts = mergeUsersById(cached?.data, payload.data);
    store.contacts.value = mergedContacts.map(normalizeUser);
    writeChatCache(cacheUserId(), "contacts", { data: mergedContacts, cachedAt: new Date().toISOString() }).catch(() => {});
  }

  async function loadConversations() {
    if (!store.conversations.value.length) setLoadState(store.conversationLoadState, "loading");
    const cached = await readChatCache(cacheUserId(), "conversations");
    if (Array.isArray(cached?.data) && cached.data.length && !store.conversations.value.length) {
      store.conversations.value = applyLocalConversationVisibility(cacheUserId(), cached.data);
      setLoadState(store.conversationLoadState, "ready");
    }
    try {
      const payload = await chatApi.getJson("/api/v1/conversations");
      const mergedConversations = mergeConversationsById(cached?.data, payload.data);
      store.conversations.value = applyLocalConversationVisibility(cacheUserId(), mergedConversations);
      writeChatCache(cacheUserId(), "conversations", { data: store.conversations.value, cachedAt: new Date().toISOString() }).catch(() => {});
      setLoadState(store.conversationLoadState, "ready");
      if (!store.selectedId.value && store.conversations.value.length) store.selectedId.value = store.conversations.value[0].id;
      if (store.selectedId.value && !store.conversations.value.find((item) => item.id === store.selectedId.value)) {
        store.selectedId.value = store.conversations.value[0]?.id || "";
      }
    } catch (error) {
      if (!store.conversations.value.length) setLoadState(store.conversationLoadState, "error", error?.message || "加载会话失败，请重试");
      throw error;
    }
  }

  async function loadParticipants() {
    if (!store.selectedId.value) {
      store.participants.value = [];
      return;
    }
    const cacheKey = `participants-${store.selectedId.value}`;
    const cached = await readChatCache(cacheUserId(), cacheKey);
    if (Array.isArray(cached?.data) && cached.data.length && !store.participants.value.length) {
      store.participants.value = cached.data.map(normalizeUser);
    }
    const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/participants`);
    const mergedParticipants = mergeUsersById(cached?.data, payload.data);
    store.participants.value = mergedParticipants.map(normalizeUser);
    writeChatCache(cacheUserId(), cacheKey, { data: mergedParticipants, cachedAt: new Date().toISOString() }).catch(() => {});
  }

  return {
    loadContacts,
    loadConversations,
    loadParticipants,
  };
}
