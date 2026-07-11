<script setup>
import { computed, onMounted } from "vue";
import AnnouncementDialog from "./components/AnnouncementDialog.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ConversationSidebar from "./components/ConversationSidebar.vue";
import CreateConversationDialog from "./components/CreateConversationDialog.vue";
import MessagePanel from "./components/MessagePanel.vue";
import InfoSidebar from "./components/InfoSidebar.vue";
import ToastStack from "./components/ToastStack.vue";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { getAuth, logout } from "../shared/session.js";
import { getDesktopConversationId, getDesktopWindowKind, isDesktopRuntime } from "../shared/runtime.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";

const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const realtime = useChatRealtime(auth, store.selectedId, store.conversations, store.socketOnline, actions.refreshAll);
const queryConversationId = new URLSearchParams(window.location.search).get("conversationId") || "";
const desktopConversationId = getDesktopConversationId() || queryConversationId;
const standaloneConversationMode = computed(() => (
  isDesktopRuntime() && getDesktopWindowKind() === "chat"
));
const showStandaloneInfoSidebar = computed(() => (
  standaloneConversationMode.value && Boolean(store.selectedConversation.value)
));

function handleComposerKeydown(event) {
  if (event.key === "Escape") {
    store.mentionOpen.value = false;
    store.mentionOptions.value = [];
  }
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    actions.submitComposer().catch((error) => {
      store.setComposerHint(error?.message || "发送失败", "error");
    });
    return;
  }
  store.updateMentionState();
}

async function selectConversation(id) {
  await actions.selectConversation(id);
  realtime.joinSelectedConversation();
}

function cancelEdit() {
  store.clearReplyState();
  store.messageInput.value = "";
  store.mentionOpen.value = false;
  store.mentionOptions.value = [];
}

function openFilePicker() {
  const input = document.querySelector(".composer input[type='file']");
  if (!input) return;
  input.value = "";
  input.click();
}

function handleFileChange(event) {
  actions.uploadFiles(event.target?.files || []).catch((error) => {
    store.setComposerHint(error?.message || "上传失败", "error");
  });
}

function handleAvatarUpload(event) {
  const file = event.target?.files?.[0];
  actions.uploadAvatar(file).catch((error) => {
    store.profileHint.value = error?.message || "头像上传失败";
    store.profileHintTone.value = "error";
  });
}

onMounted(async () => {
  try {
    await actions.loadProfile(auth);
    await actions.loadContacts();
    await actions.loadConversations();
    if (standaloneConversationMode.value && desktopConversationId) {
      await actions.selectConversation(desktopConversationId);
    } else {
      await actions.refreshSelectedConversation();
    }
    realtime.connect();
  } catch (error) {
    store.setComposerHint(error?.message || "聊天初始化失败", "error");
  }
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
        'has-standalone-sidebar': showStandaloneInfoSidebar,
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
        @update:keyword="store.conversationKeyword.value = $event"
        @select="selectConversation"
        @refresh="actions.refreshAll"
        @new-direct="actions.createDirectConversation"
        @new-group="actions.createGroupConversation"
        @toggle-pin="actions.toggleConversationPinById"
        @logout="logout"
      />

      <MessagePanel
        :chat-title="store.chatTitle.value"
        :chat-subtitle="store.chatSubtitle.value"
        :message-keyword="store.messageKeyword.value"
        :socket-online="store.socketOnline.value"
        :search-result-text="store.searchResultText.value"
        :messages="store.renderedMessages.value"
        :reply-text="store.replyText.value"
        :show-reply-bar="store.showReplyBar.value"
        :editing="Boolean(store.editingMessageId.value)"
        :message-input="store.messageInput.value"
        :mention-open="store.mentionOpen.value"
        :mention-options="store.mentionOptions.value"
        :composer-hint="store.composerHint.value"
        :composer-hint-tone="store.composerHintTone.value"
        :uploading-files="store.uploadingFiles.value"
        :upload-progress-text="store.uploadProgressText.value"
        :is-pinned="Boolean(store.selectedConversation.value?.pinnedAt)"
        :has-more-messages="store.hasMoreMessages.value"
        :loading-more-messages="store.loadingMoreMessages.value"
        :standalone-mode="standaloneConversationMode"
        @update:message-keyword="store.messageKeyword.value = $event"
        @search="actions.searchMessages"
        @announcement="actions.sendAnnouncement"
        @mark-read="actions.markSelectedConversationRead"
        @toggle-pin="actions.toggleConversationPin"
        @cancel-edit="cancelEdit"
        @update:message-input="store.messageInput.value = $event; store.updateMentionState($event)"
        @message-keydown="handleComposerKeydown"
        @mention-pick="store.applyMention"
        @submit="actions.submitComposer"
        @message-action="actions.handleMessageAction"
        @open-file-picker="openFilePicker"
        @file-change="handleFileChange"
        @download-file="actions.downloadFile"
        @load-more="actions.loadOlderMessages"
      />

      <InfoSidebar
        v-if="!standaloneConversationMode || showStandaloneInfoSidebar"
        :me-avatar-url="store.meAvatarUrl.value"
        :profile-name="store.profileName.value"
        :profile-bio="store.profileBio.value"
        :profile-hint="store.profileHint.value"
        :profile-hint-tone="store.profileHintTone.value"
        :participants="store.participants.value"
        :standalone-mode="standaloneConversationMode"
        @update:profile-name="store.profileName.value = $event"
        @update:profile-bio="store.profileBio.value = $event"
        @save-profile="actions.saveProfile"
        @upload-avatar="handleAvatarUpload"
      />
    </section>

    <ToastStack :notifications="store.notifications.value" @dismiss="store.dismissNotification" />

    <CreateConversationDialog
      v-if="!standaloneConversationMode"
      :open="store.createDialogOpen.value"
      :mode="store.createDialogMode.value"
      :title="store.createDialogTitle.value"
      :peer-id="store.selectedPeerId.value"
      :participant-ids="store.createDialogParticipantIds.value"
      :contacts="store.createDialogContacts.value"
      :selected-participants="store.selectedParticipants.value"
      :hint="store.createDialogHint.value"
      :hint-tone="store.createDialogHintTone.value"
      :submitting="store.createDialogSubmitting.value"
      @close="store.closeCreateDialog"
      @submit="actions.submitCreateConversation"
      @update:title="store.createDialogTitle.value = $event"
      @update:peer-id="store.createDialogPeerId.value = $event"
      @toggle-participant="store.toggleDialogParticipant"
    />

    <AnnouncementDialog
      :open="store.announcementDialogOpen.value"
      :draft="store.announcementDraft.value"
      :hint="store.announcementHint.value"
      :hint-tone="store.announcementHintTone.value"
      :submitting="store.announcementSubmitting.value"
      @close="store.closeAnnouncementDialog"
      @submit="actions.submitAnnouncement"
      @update:draft="store.announcementDraft.value = $event"
    />

    <ConfirmDialog
      :open="store.confirmDialogOpen.value"
      :title="store.confirmDialogTitle.value"
      :message="store.confirmDialogMessage.value"
      :confirm-text="store.confirmDialogConfirmText.value"
      :submitting="store.confirmDialogSubmitting.value"
      @close="store.closeConfirmDialog"
      @submit="actions.submitConfirmDialog"
    />
  </main>
</template>
