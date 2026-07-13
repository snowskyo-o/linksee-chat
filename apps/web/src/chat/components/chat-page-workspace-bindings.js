import { computed } from "vue";

export function createConversationSidebarProps(props) {
  return computed(() => ({
    meName: props.store.meName.value,
    meMeta: props.store.meMeta.value,
    meAvatar: props.store.meAvatar.value,
    meAvatarUrl: props.store.meAvatarUrl.value,
    keyword: props.store.conversationKeyword.value,
    conversations: props.store.filteredConversations.value,
    selectedId: props.store.selectedId.value,
    loadState: props.store.conversationLoadState.value,
  }));
}

export function createMessagePanelProps(props) {
  return computed(() => ({
    chatTitle: props.store.chatTitle.value,
    chatSubtitle: props.store.chatSubtitle.value,
    chatKind: props.store.selectedConversation.value?.kind || "",
    hasConversation: Boolean(props.store.selectedConversation.value),
    participantCount:
      props.store.selectedConversation.value?.participantIds?.length || props.store.participants.value.length,
    messageKeyword: props.store.messageKeyword.value,
    socketOnline: props.store.socketOnline.value,
    networkBannerText: props.runtime.networkBannerText,
    searchResultText: props.store.searchResultText.value,
    searching: Boolean(props.store.searchKeyword.value),
    messages: props.store.renderedMessages.value,
    replyText: props.store.replyText.value,
    showReplyBar: props.store.showReplyBar.value,
    messageInput: props.store.messageInput.value,
    mentionOpen: props.store.mentionOpen.value,
    mentionOptions: props.store.mentionOptions.value,
    composerHint: props.store.composerHint.value,
    composerHintTone: props.store.composerHintTone.value,
    pendingFiles: props.store.pendingFiles.value,
    uploadingFiles: props.store.uploadingFiles.value,
    uploadProgressText: props.store.uploadProgressText.value,
    downloadProgressText: props.store.downloadProgressText.value,
    hasMoreMessages: props.store.hasMoreMessages.value,
    loadingMoreMessages: props.store.loadingMoreMessages.value,
    loadState: props.store.messageLoadState.value,
    standaloneMode: props.standaloneConversationMode,
    stickers: props.stickerLibrary.stickers.value,
    recentStickers: props.stickerLibrary.recentStickers.value,
    stickersLoading: props.stickerLibrary.loading.value,
    stickersHint: props.stickerLibrary.hint.value,
    stickersHintTone: props.stickerLibrary.hintTone.value,
  }));
}

export function createInfoSidebarProps(props) {
  return computed(() => ({
    conversation: props.store.selectedConversation.value,
    participants: props.store.participants.value,
    currentUserId: props.auth.userId,
    standaloneMode: props.standaloneConversationMode,
  }));
}

export function createMessagePanelListeners(props) {
  return {
    "cancel-edit": () => props.runtime.cancelEdit(),
    "capture-screenshot": () => props.runtime.captureScreenshot(),
    "clear-recent-stickers": () => props.stickerLibrary.clearRecent(),
    "clear-search": () => props.runtime.clearMessageSearch(),
    "download-file": (file) => props.actions.downloadFile(file),
    "file-change": (event) => props.runtime.handleFileChange(event),
    "file-paste": (event) => props.runtime.handleFilePaste(event),
    "load-more": () => props.actions.loadOlderMessages(),
    "mention-pick": (user) => props.store.applyMention(user),
    "message-action": (payload) => props.actions.handleMessageAction(payload),
    "message-keydown": (event) => props.runtime.handleComposerKeydown(event),
    "open-file": (file) => props.actions.openFile(file),
    "open-file-location": (file) => props.actions.openFileLocation(file),
    "open-image": (file) => props.runtime.openImageViewer(file),
    "open-file-picker": () => props.runtime.openFilePicker(),
    "open-sticker-import": () => props.runtime.openStickerImport(),
    "remove-pending-file": (file) => props.store.removePendingFile(file),
    "retry-pending-file": (id) => {
      const target = props.store.pendingFiles.value.find((item) => item.id === id && item.file);
      if (!target) return;
      props.actions.uploadFiles([target]).catch(() => {});
    },
    "retry-load": () => props.runtime.reloadSelectedConversation(),
    "save-file-as": (file) => props.actions.saveFileAs(file),
    search: () => props.actions.searchMessages(),
    "send-sticker": (sticker) => props.runtime.handleSendSticker(sticker),
    submit: () => props.actions.submitComposer(),
    "update:messageInput": (value) => ((props.store.messageInput.value = value), props.store.updateMentionState(value)),
    "update:messageKeyword": (value) => (props.store.messageKeyword.value = value),
  };
}
