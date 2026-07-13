<script setup>
import { computed } from "vue";
import ChatDialogs from "./components/ChatDialogs.vue";
import ConversationSidebar from "./components/ConversationSidebar.vue";
import MessagePanel from "./components/MessagePanel.vue";
import InfoSidebar from "./components/InfoSidebar.vue";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { getAuth, logout } from "../shared/session.js";
import { getDesktopConversationId, getDesktopWindowKind, isDesktopRuntime } from "../shared/runtime.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";
import { useGroupManagement } from "./composables/useGroupManagement.js";
import { usePasswordChange } from "./composables/usePasswordChange.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";
import { useChatPageRuntime } from "./composables/useChatPageRuntime.js";
import { useStickerLibrary } from "./composables/useStickerLibrary.js";

const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const groupManagement = useGroupManagement(store, actions);
const passwordChange = usePasswordChange();
const stickerLibrary = useStickerLibrary();
const queryConversationId = new URLSearchParams(window.location.search).get("conversationId") || "";
const desktopConversationId = getDesktopConversationId() || queryConversationId;
const standaloneConversationMode = computed(() => (
  isDesktopRuntime() && getDesktopWindowKind() === "chat"
));
let runtime = null;
const realtime = useChatRealtime(
  auth,
  store.selectedId,
  store.conversations,
  store.socketOnline,
  (event) => runtime?.handleRealtimeEvent?.(event),
);

async function selectConversation(id) {
  await actions.selectConversation(id);
  realtime.joinSelectedConversation();
}
runtime = useChatPageRuntime({
  auth,
  store,
  actions,
  realtime,
  stickerLibrary,
  desktopConversationId,
  standaloneConversationMode,
  selectConversation,
});
</script>

<template>
  <main class="desktop-page-shell chat-page-shell">
    <DesktopTitlebar
      v-if="!standaloneConversationMode"
      app-title="Linksee Chat"
      :view-title="store.chatTitle.value || '消息'"
      :view-meta="standaloneConversationMode ? '独立聊天窗口' : (store.socketOnline.value ? '实时连接已建立' : '正在连接服务端')"
    />

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
        @logout="logout"
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

    <ChatDialogs
      :standalone-conversation-mode="standaloneConversationMode"
      :update-prompt-open="runtime.updatePromptOpen"
      :app-info="runtime.appInfo"
      :settings-open="runtime.settingsOpen"
      :app-settings="runtime.appSettings"
      :desktop-preferences="runtime.desktopPreferences"
      :auth="auth"
      :store="store"
      :actions="actions"
      :password-change="passwordChange"
      :sticker-import-open="runtime.stickerImportOpen"
      :sticker-library="stickerLibrary"
      :image-viewer-open="runtime.imageViewerOpen"
      :image-viewer-title="runtime.imageViewerTitle"
      :image-viewer-src="runtime.imageViewerSrc"
      :image-viewer-loading="runtime.imageViewerLoading"
      :image-viewer-hint="runtime.imageViewerHint"
      :image-viewer-status-text="runtime.imageViewerStatusText"
      :image-viewer-active-file="runtime.imageViewerActiveFile"
      :image-viewer-owner-message-id="runtime.imageViewerOwnerMessageId"
      :group-management="groupManagement"
      @update-now="runtime.handleUpdateNow"
      @remind-later="runtime.remindUpdateLater"
      @close-update="runtime.closeUpdatePrompt"
      @close-settings="runtime.closeSettings"
      @update:settings="runtime.persistSettings"
      @update:desktop-preferences="runtime.persistDesktopPreferences"
      @update:profile-name="store.profileName.value = $event"
      @update:profile-bio="store.profileBio.value = $event"
      @save-profile="actions.saveProfile"
      @submit-password="passwordChange.submitPassword"
      @logout="logout"
      @upload-avatar="runtime.handleAvatarUpload"
      @choose-download-dir="runtime.chooseDownloadDirectory"
      @open-download-dir="runtime.openDownloadDirectory"
      @clear-cache="runtime.clearDesktopCache"
      @open-update="runtime.handleUpdateNow"
      @close-sticker-import="runtime.closeStickerImport"
      @import-sticker-files="runtime.importStickerFiles"
      @import-sticker-folder="runtime.importStickerFolder"
      @open-sticker-folder="runtime.openStickerFolder"
      @rename-sticker="runtime.renameSticker"
      @delete-sticker="runtime.deleteSticker"
      @move-sticker="runtime.moveSticker"
      @close-image-viewer="runtime.closeImageViewer"
      @download-image="runtime.saveImageFromViewer"
      @copy-image="runtime.copyImageFromViewer"
      @forward-image="runtime.forwardImageFromViewer"
      @open-image-location="runtime.openImageLocationFromViewer"
    />
  </main>
</template>
