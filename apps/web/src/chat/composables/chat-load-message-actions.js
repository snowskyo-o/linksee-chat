import { readChatCache, writeChatCache } from "./local-chat-cache.js";
import { normalizeMessage, patchConversationLocally } from "./message-operations.js";
import { filterLocallyVisibleMessages } from "./message-visibility-cache.js";
import { mergeMessagesById } from "./chat-profile-merge-conversations.js";

export function createChatLoadMessageActions({ store, chatApi, cacheUserId, setLoadState }) {
  async function loadMessages() {
    if (!store.selectedId.value) {
      store.messages.value = [];
      store.hasMoreMessages.value = false;
      setLoadState(store.messageLoadState, "ready");
      return;
    }
    if (!store.messages.value.length) setLoadState(store.messageLoadState, "loading");
    const canUseCache = !store.searchKeyword.value;
    let cached = null;
    if (canUseCache) {
      cached = await readChatCache(cacheUserId(), `messages-${store.selectedId.value}`);
      if (Array.isArray(cached?.data) && cached.data.length && !store.messages.value.length) {
        store.messages.value = filterLocallyVisibleMessages(cacheUserId(), store.selectedId.value, cached.data).map(normalizeMessage);
        store.hasMoreMessages.value = Boolean(cached?.hasMoreMessages);
        setLoadState(store.messageLoadState, "ready");
      }
    }
    const path = store.searchKeyword.value
      ? `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/search?q=${encodeURIComponent(store.searchKeyword.value)}`
      : `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?limit=50`;
    try {
      const payload = await chatApi.getJson(path);
      const mergedMessages = mergeMessagesById(canUseCache ? cached?.data : store.messages.value, payload.data);
      const visibleMessages = filterLocallyVisibleMessages(cacheUserId(), store.selectedId.value, mergedMessages);
      store.messages.value = visibleMessages.map(normalizeMessage);
      store.hasMoreMessages.value = !store.searchKeyword.value && store.messages.value.length >= 50;
      setLoadState(store.messageLoadState, "ready");
      if (!store.searchKeyword.value) {
        writeChatCache(cacheUserId(), `messages-${store.selectedId.value}`, {
          data: visibleMessages,
          hasMoreMessages: store.hasMoreMessages.value,
          cachedAt: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch (error) {
      if (!store.messages.value.length) setLoadState(store.messageLoadState, "error", error?.message || "加载消息失败，请重试");
      throw error;
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
      const older = filterLocallyVisibleMessages(cacheUserId(), store.selectedId.value, payload.data).map(normalizeMessage);
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

  async function markConversationReadIfNeeded() {
    const selected = store.selectedConversation.value;
    const lastMessage = store.messages.value[store.messages.value.length - 1];
    if (!selected || !lastMessage?.id || (!selected.unreadCount && !selected.unreadMentionCount)) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/read`, { messageId: lastMessage.id });
    patchConversationLocally(store, selected.id, { unreadCount: 0, unreadMentionCount: 0, lastReadAt: new Date().toISOString() });
  }

  return {
    loadMessages,
    loadOlderMessages,
    markConversationReadIfNeeded,
  };
}
