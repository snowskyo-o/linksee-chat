const FAVORITES_STORAGE_KEY = "linksee_chat_favorite_messages";

export function loadFavoriteMessages() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map((item) => ({
      id: String(item.id || ""),
      conversationId: String(item.conversationId || ""),
      conversationTitle: String(item.conversationTitle || "收藏消息"),
      senderName: String(item.senderName || "未知用户"),
      content: String(item.content || ""),
      createdAt: String(item.createdAt || ""),
    })).filter((item) => item.id && item.conversationId) : [];
  } catch {
    return [];
  }
}

export function saveFavoriteMessages(items) {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
}
