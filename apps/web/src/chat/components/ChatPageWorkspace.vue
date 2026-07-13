<script setup>
import ConversationSidebar from "./ConversationSidebar.vue";
import InfoSidebar from "./InfoSidebar.vue";
import MessagePanel from "./MessagePanel.vue";

defineEmits(["logout"]);

defineProps({
  actions: { type: Object, required: true },
  auth: { type: Object, required: true },
  groupManagement: { type: Object, required: true },
  runtime: { type: Object, required: true },
  selectConversation: { type: Function, required: true },
  standaloneConversationMode: { type: Object, required: true },
  stickerLibrary: { type: Object, required: true },
  store: { type: Object, required: true },
});
</script>

<template>
  <section
    class="qq-shell"
    :class="{
      'is-conversation-window': standaloneConversationMode,
      'has-standalone-sidebar': runtime.showStandaloneInfoSidebar,
    }"
  >
    <ConversationSidebar
      v-if="!standaloneConversationMode"
      :me-name="store.meName.value"
      :me-meta="store.meMeta.value"
      :me-avatar="store.meAvatar.value"
      :me-avatar-url="store.meAvatarUrl.value"
      :keyword="store.conversationKeyword.value"
      :conversations="store.filteredConversations.value"
      :selected-id="store.selectedId.value"
      :load-state="store.conversationLoadState.value"
      @update:keyword="store.conversationKeyword.value = $event"
      @select="selectConversation"
      @refresh="actions.refreshAll"
      @new-direct="actions.createDirectConversation"
      @new-group="actions.createGroupConversation"
      @open-settings="runtime.openSettings"
      @toggle-pin="actions.toggleConversationPinById"
      @logout="$emit('logout')"
      @retry-load="runtime.reloadConversationList"
    />

    <MessagePanel
      :chat-title="store.chatTitle.value"
      :chat-subtitle="store.chatSubtitle.value"
      :chat-kind="store.selectedConversation.value?.kind || ''"
      :has-conversation="Boolean(store.selectedConversation.value)"
      :participant-count="store.selectedConversation.value?.participantIds?.length || store.participants.value.length"
      :message-keyword="store.messageKeyword.value"
      :socket-online="store.socketOnline.value"
      :network-banner-text="runtime.networkBannerText"
      :search-result-text="store.searchResultText.value"
      :searching="Boolean(store.searchKeyword.value)"
      :messages="store.renderedMessages.value"
      :reply-text="store.replyText.value"
      :show-reply-bar="store.showReplyBar.value"
      :message-input="store.messageInput.value"
      :mention-open="store.mentionOpen.value"
      :mention-options="store.mentionOptions.value"
      :composer-hint="store.composerHint.value"
      :composer-hint-tone="store.composerHintTone.value"
      :pending-files="store.pendingFiles.value"
      :uploading-files="store.uploadingFiles.value"
      :upload-progress-text="store.uploadProgressText.value"
      :download-progress-text="store.downloadProgressText.value"
      :has-more-messages="store.hasMoreMessages.value"
      :loading-more-messages="store.loadingMoreMessages.value"
      :load-state="store.messageLoadState.value"
      :standalone-mode="standaloneConversationMode"
      :stickers="stickerLibrary.stickers.value"
      :recent-stickers="stickerLibrary.recentStickers.value"
      :stickers-loading="stickerLibrary.loading.value"
      :stickers-hint="stickerLibrary.hint.value"
      :stickers-hint-tone="stickerLibrary.hintTone.value"
      @update:message-keyword="store.messageKeyword.value = $event"
      @search="actions.searchMessages"
      @clear-search="runtime.clearMessageSearch"
      @cancel-edit="runtime.cancelEdit"
      @update:message-input="store.messageInput.value = $event; store.updateMentionState($event)"
      @message-keydown="runtime.handleComposerKeydown"
      @mention-pick="store.applyMention"
      @submit="actions.submitComposer"
      @message-action="actions.handleMessageAction"
      @open-file-picker="runtime.openFilePicker"
      @capture-screenshot="runtime.captureScreenshot"
      @open-sticker-import="runtime.openStickerImport"
      @send-sticker="runtime.handleSendSticker"
      @clear-recent-stickers="stickerLibrary.clearRecent"
      @file-change="runtime.handleFileChange"
      @file-paste="runtime.handleFilePaste"
      @file-drop="runtime.handleFileDrop"
      @remove-pending-file="store.removePendingFile"
      @download-file="actions.downloadFile"
      @save-file-as="actions.saveFileAs"
      @open-file="actions.openFile"
      @open-file-location="actions.openFileLocation"
      @copy-image="actions.copyImageToClipboard"
      @open-image="runtime.openImageViewer"
      @load-more="actions.loadOlderMessages"
      @retry-load="runtime.reloadSelectedConversation"
    />

    <InfoSidebar
      v-if="!standaloneConversationMode || runtime.showStandaloneInfoSidebar"
      :conversation="store.selectedConversation.value"
      :participants="store.participants.value"
      :current-user-id="auth.userId"
      :standalone-mode="standaloneConversationMode"
      @rename-group="groupManagement.renameGroup"
      @invite-group-members="groupManagement.openInviteDialog"
      @leave-group="groupManagement.requestLeaveGroup"
      @remove-group-member="groupManagement.requestRemoveMember"
    />
  </section>
</template>
