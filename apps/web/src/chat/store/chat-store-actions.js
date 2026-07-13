import { saveConversationPreferences } from "../../shared/conversation-preferences.js";
import { revokePendingAttachment } from "../composables/file-attachments.js";

export function createChatStoreActions(state, derived, saveFavoriteMessages) {
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

  function persistConversationPreferences() {
    const saved = saveConversationPreferences({
      mutedConversationIds: state.mutedConversationIds.value,
      hiddenConversationIds: state.hiddenConversationIds.value,
    });
    state.mutedConversationIds.value = saved.mutedConversationIds;
    state.hiddenConversationIds.value = saved.hiddenConversationIds;
  }

  function toggleConversationMuted(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return false;
    state.mutedConversationIds.value = state.mutedConversationIds.value.includes(targetId)
      ? state.mutedConversationIds.value.filter((item) => item !== targetId)
      : [...state.mutedConversationIds.value, targetId];
    persistConversationPreferences();
    return state.mutedConversationIds.value.includes(targetId);
  }

  function hideConversation(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return;
    state.hiddenConversationIds.value = state.hiddenConversationIds.value.includes(targetId)
      ? state.hiddenConversationIds.value
      : [...state.hiddenConversationIds.value, targetId];
    persistConversationPreferences();
  }

  function showConversation(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return;
    state.hiddenConversationIds.value = state.hiddenConversationIds.value.filter((item) => item !== targetId);
    persistConversationPreferences();
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

  function openCreateDialog(mode) {
    state.createDialogMode.value = mode;
    state.createDialogOpen.value = true;
    state.createDialogTitle.value = "";
    state.createDialogPeerId.value = state.contacts.value[0]?.id || "";
    state.createDialogParticipantIds.value = state.contacts.value.map((user) => user.id).slice(0, 2);
    state.createDialogSubmitting.value = false;
    setCreateDialogHint("", "");
  }

  function closeCreateDialog() {
    state.createDialogOpen.value = false;
    state.createDialogSubmitting.value = false;
    setCreateDialogHint("", "");
  }

  function openAnnouncementDialog() {
    state.announcementDialogOpen.value = true;
    state.announcementSubmitting.value = false;
    state.announcementDraft.value = "";
    setAnnouncementHint("", "");
  }

  function closeAnnouncementDialog() {
    state.announcementDialogOpen.value = false;
    state.announcementSubmitting.value = false;
    setAnnouncementHint("", "");
  }

  function openConfirmDialog({ title, message, confirmText = "确认", action = null }) {
    state.confirmDialogOpen.value = true;
    state.confirmDialogTitle.value = title || "请确认";
    state.confirmDialogMessage.value = message || "确定继续吗？";
    state.confirmDialogConfirmText.value = confirmText;
    state.confirmDialogSubmitting.value = false;
    state.pendingConfirmAction.value = action;
  }

  function closeConfirmDialog() {
    state.confirmDialogOpen.value = false;
    state.confirmDialogSubmitting.value = false;
    state.pendingConfirmAction.value = null;
  }

  function toggleDialogParticipant(userId) {
    if (state.createDialogParticipantIds.value.includes(userId)) {
      state.createDialogParticipantIds.value = state.createDialogParticipantIds.value.filter((item) => item !== userId);
      return;
    }
    state.createDialogParticipantIds.value = [...state.createDialogParticipantIds.value, userId];
  }

  function clearReplyState() {
    state.replyTo.value = null;
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

  function openForwardDialog(messageId) {
    state.forwardingMessageId.value = String(messageId || "");
    state.forwardConversationId.value = state.selectedId.value || state.conversations.value[0]?.id || "";
    state.forwardHint.value = "";
    state.forwardSubmitting.value = false;
    state.forwardDialogOpen.value = true;
  }

  function closeForwardDialog() {
    state.forwardDialogOpen.value = false;
    state.forwardingMessageId.value = "";
    state.forwardConversationId.value = "";
    state.forwardHint.value = "";
    state.forwardSubmitting.value = false;
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

  function resetComposer() {
    state.messageInput.value = "";
    state.mentionOpen.value = false;
    state.mentionOptions.value = [];
    state.uploadProgress.value = 0;
    state.uploadFileName.value = "";
    setComposerHint("", "");
    state.searchKeyword.value = "";
    state.messageKeyword.value = "";
  }

  function clearPendingFiles() {
    state.pendingFiles.value.forEach(revokePendingAttachment);
    state.pendingFiles.value = [];
  }

  function removePendingFile(id) {
    const target = state.pendingFiles.value.find((item) => item.id === id);
    revokePendingAttachment(target);
    state.pendingFiles.value = state.pendingFiles.value.filter((item) => item.id !== id);
  }

  function updatePendingFile(id, patch) {
    const targetId = String(id || "");
    if (!targetId) return;
    state.pendingFiles.value = state.pendingFiles.value.map((item) => (
      item.id === targetId
        ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
        : item
    ));
  }

  function removePendingFiles(ids = []) {
    const idSet = new Set(ids.map((id) => String(id || "")).filter(Boolean));
    state.pendingFiles.value.forEach((item) => {
      if (idSet.has(String(item.id || ""))) revokePendingAttachment(item);
    });
    state.pendingFiles.value = state.pendingFiles.value.filter((item) => !idSet.has(String(item.id || "")));
  }

  function setFileTransfer(objectKey, patch) {
    const key = String(objectKey || "");
    if (!key) return;
    state.fileTransfers.value = {
      ...state.fileTransfers.value,
      [key]: {
        ...(state.fileTransfers.value[key] || {}),
        ...patch,
      },
    };
  }

  return {
    applyMention,
    clearPendingFiles,
    clearReplyState,
    closeAnnouncementDialog,
    closeConfirmDialog,
    closeCreateDialog,
    closeForwardDialog,
    collectMentionIds,
    dismissNotification,
    hideConversation,
    openAnnouncementDialog,
    openConfirmDialog,
    openCreateDialog,
    openForwardDialog,
    pushNotification,
    removeFavoriteMessage,
    removePendingFile,
    removePendingFiles,
    resetComposer,
    setAnnouncementHint,
    setComposerHint,
    setCreateDialogHint,
    setFileTransfer,
    showConversation,
    toggleConversationMuted,
    toggleDialogParticipant,
    toggleFavoriteMessage,
    updateMentionState,
    updatePendingFile,
  };
}
