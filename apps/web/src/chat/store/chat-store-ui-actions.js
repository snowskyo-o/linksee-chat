export function createChatStoreUiActions(state, derived, saveFavoriteMessages) {
  function pushNotification({ title, message = "", tone = "success", ttl = 3200 }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    state.notifications.value = [...state.notifications.value, { id, title, message, tone }];
    if (ttl > 0) {
      window.setTimeout(() => dismissNotification(id), ttl);
    }
    return id;
  }

  function dismissNotification(id) {
    state.notifications.value = state.notifications.value.filter((item) => item.id !== id);
  }

  function setComposerHint(message, tone = "") {
    state.composerHint.value = message || "";
    state.composerHintTone.value = tone;
  }

  function setCreateDialogHint(message, tone = "") {
    state.createDialogHint.value = message || "";
    state.createDialogHintTone.value = tone;
  }

  function setAnnouncementHint(message, tone = "") {
    state.announcementHint.value = message || "";
    state.announcementHintTone.value = tone;
  }

  function toggleFavoriteMessage(message) {
    const targetId = String(message?.id || "");
    if (!targetId) return;
    if (state.favoriteMessages.value.some((item) => item.id === targetId)) {
      state.favoriteMessages.value = state.favoriteMessages.value.filter((item) => item.id !== targetId);
    } else {
      state.favoriteMessages.value = [{
        id: targetId,
        conversationId: String(message.conversationId || state.selectedId.value || ""),
        conversationTitle: derived.chatTitle.value || "收藏消息",
        senderName: message.sender?.profile?.realName || message.senderName || message.senderId || "未知用户",
        content: message.content || "[空消息]",
        createdAt: message.createdAt || new Date().toISOString(),
      }, ...state.favoriteMessages.value];
    }
    saveFavoriteMessages(state.favoriteMessages.value);
  }

  function removeFavoriteMessage(messageId) {
    const targetId = String(messageId || "");
    if (!targetId) return;
    state.favoriteMessages.value = state.favoriteMessages.value.filter((item) => item.id !== targetId);
    saveFavoriteMessages(state.favoriteMessages.value);
  }

  function collectMentionIds(content) {
    return state.participants.value
      .filter((user) => content.includes(`@${user.profile.realName || user.id}`))
      .map((user) => user.id);
  }
  function updateMentionState(nextValue = state.messageInput.value) {
    const cursor = nextValue.length;
    const head = nextValue.slice(0, cursor);
    const match = head.match(/(^|\s)@([A-Za-z0-9_\-\u4e00-\u9fa5]*)$/);
    if (!match) {
      state.mentionOpen.value = false;
      state.mentionOptions.value = [];
      return;
    }

    state.mentionOpen.value = true;
    state.mentionKeyword.value = match[2] || "";
    state.mentionStart.value = cursor - state.mentionKeyword.value.length - 1;
    state.mentionOptions.value = state.participants.value.filter((user) => {
      const name = String(user.profile?.realName || "").toLowerCase();
      return !state.mentionKeyword.value || name.includes(state.mentionKeyword.value.toLowerCase());
    });
  }
  function applyMention(userId) {
    const user = state.participants.value.find((item) => item.id === userId);
    if (!user) return;
    const before = state.messageInput.value.slice(0, state.mentionStart.value);
    state.messageInput.value = `${before}@${user.profile.realName || user.id} `;
    state.mentionOpen.value = false;
    state.mentionOptions.value = [];
  }

  return {
    applyMention,
    collectMentionIds,
    dismissNotification,
    pushNotification,
    removeFavoriteMessage,
    setAnnouncementHint,
    setComposerHint,
    setCreateDialogHint,
    toggleFavoriteMessage,
    updateMentionState,
  };
}
