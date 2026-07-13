import { computed } from "vue";

export function useConversationSearchSections(store, searchKeyword, contactRows) {
  return computed(() => {
    const keyword = searchKeyword.value.toLowerCase();
    if (!keyword) return [];

    const includesKeyword = (...values) => values.some((value) => String(value || "").toLowerCase().includes(keyword));

    const conversations = store.conversationRows.value
      .filter((row) => includesKeyword(row.displayTitle, row.displaySubtitle, row.preview))
      .slice(0, 5)
      .map((row) => ({
        key: `conversation:${row.id}`,
        id: row.id,
        title: row.displayTitle,
        subtitle: row.preview,
        meta: row.kind === "group" ? (row.isHidden ? "群聊 · 已隐藏" : "群聊") : (row.isHidden ? "会话 · 已隐藏" : "会话"),
        kind: row.kind === "group" ? "group" : "conversation",
        avatarUrl: row.avatarUrl,
        avatarText: (row.displayTitle || "?").slice(0, 2).toUpperCase(),
        action: "conversation",
      }));

    const contacts = contactRows.value
      .filter((row) => includesKeyword(row.title, row.subtitle))
      .slice(0, 5)
      .map((row) => ({
        ...row,
        action: "contact",
      }));

    const favorites = store.favoriteMessages.value
      .filter((item) => includesKeyword(item.conversationTitle, item.senderName, item.content))
      .slice(0, 4)
      .map((item) => ({
        key: `favorite:${item.id}:${item.conversationId}`,
        id: item.id,
        conversationId: item.conversationId,
        title: item.conversationTitle,
        subtitle: `${item.senderName}：${item.content || "[空消息]"}`,
        meta: "收藏消息",
        kind: "favorite",
        avatarUrl: "",
        avatarText: "★",
        action: "favorite",
      }));

    return [
      { key: "conversations", title: "会话", items: conversations },
      { key: "contacts", title: "联系人", items: contacts },
      { key: "favorites", title: "收藏消息", items: favorites },
    ];
  });
}
