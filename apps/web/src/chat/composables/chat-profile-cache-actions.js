import { writeChatCache } from "./local-chat-cache.js";

export function createChatProfileCacheActions({ store, cacheUserId }) {
  function persistSidebarCaches() {
    const userId = cacheUserId();
    const cachedAt = new Date().toISOString();
    writeChatCache(userId, "profile", { data: store.me.value || {}, cachedAt }).catch(() => {});
    writeChatCache(userId, "contacts", { data: store.contacts.value || [], cachedAt }).catch(() => {});
    writeChatCache(userId, "conversations", { data: store.conversations.value || [], cachedAt }).catch(() => {});
    if (store.selectedId.value) {
      writeChatCache(userId, `participants-${store.selectedId.value}`, {
        data: store.participants.value || [],
        cachedAt,
      }).catch(() => {});
    }
  }

  return { persistSidebarCaches };
}
