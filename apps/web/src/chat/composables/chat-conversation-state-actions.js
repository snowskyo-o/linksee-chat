export function createChatConversationStateActions({ store, chatApi, patchConversationLocally }) {
  async function toggleConversationPin() {
    const selected = store.selectedConversation.value;
    if (!selected?.id) return;
    if (selected.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`);
      patchConversationLocally(store, selected.id, { pinnedAt: null });
      store.setComposerHint("已取消置顶", "success");
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`, {});
    patchConversationLocally(store, selected.id, { pinnedAt: new Date().toISOString() });
    store.setComposerHint("已置顶会话", "success");
  }

  async function toggleConversationPinById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    if (!target) return;
    if (target.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`);
      patchConversationLocally(store, conversationId, { pinnedAt: null });
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`, {});
    patchConversationLocally(store, conversationId, { pinnedAt: new Date().toISOString() });
  }

  async function markConversationReadById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    const lastMessageId = target?.lastMessage?.id ? String(target.lastMessage.id) : "";
    if (!target?.id || !lastMessageId) return;
    if (!target.unreadCount && !target.unreadMentionCount) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(target.id)}/read`, {
      messageId: lastMessageId,
    });
    patchConversationLocally(store, target.id, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
  }

  return {
    markConversationReadById,
    toggleConversationPin,
    toggleConversationPinById,
  };
}
