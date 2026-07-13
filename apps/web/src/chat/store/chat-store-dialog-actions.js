export function createChatStoreDialogActions(state, setCreateDialogHint, setAnnouncementHint) {
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

  function toggleDialogParticipant(userId) {
    if (state.createDialogParticipantIds.value.includes(userId)) {
      state.createDialogParticipantIds.value = state.createDialogParticipantIds.value.filter((item) => item !== userId);
      return;
    }
    state.createDialogParticipantIds.value = [...state.createDialogParticipantIds.value, userId];
  }

  return {
    closeAnnouncementDialog,
    closeConfirmDialog,
    closeCreateDialog,
    closeForwardDialog,
    openAnnouncementDialog,
    openConfirmDialog,
    openCreateDialog,
    openForwardDialog,
    toggleDialogParticipant,
  };
}
