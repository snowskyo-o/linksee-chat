<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import AnnouncementDialog from "./components/AnnouncementDialog.vue";
import ConfirmDialog from "./components/ConfirmDialog.vue";
import ConversationSidebar from "./components/ConversationSidebar.vue";
import CreateConversationDialog from "./components/CreateConversationDialog.vue";
import ForwardDialog from "./components/ForwardDialog.vue";
import ImageViewerDialog from "./components/ImageViewerDialog.vue";
import MessagePanel from "./components/MessagePanel.vue";
import InfoSidebar from "./components/InfoSidebar.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import StickerImportDialog from "./components/StickerImportDialog.vue";
import ToastStack from "./components/ToastStack.vue";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { appendAppLog, clearAppLogs, onAppLogsUpdated, readAppLogs } from "../shared/app-log.js";
import { chatApi } from "../shared/api-client.js";
import { appendCacheBust } from "../shared/media.js";
import { getAuth, logout } from "../shared/session.js";
import { loadAppSettings, saveAppSettings } from "../shared/app-settings.js";
import { getDesktopConversationId, getDesktopWindowKind, isDesktopRuntime } from "../shared/runtime.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";
import { useStickerLibrary } from "./composables/useStickerLibrary.js";

const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const stickerLibrary = useStickerLibrary();
const queryConversationId = new URLSearchParams(window.location.search).get("conversationId") || "";
const desktopConversationId = getDesktopConversationId() || queryConversationId;
const settingsOpen = ref(false);
const appSettings = ref(loadAppSettings());
const appLogs = ref(readAppLogs());
const stickerImportOpen = ref(false);
const imageViewerOpen = ref(false);
const imageViewerTitle = ref("");
const imageViewerSrc = ref("");
const imageViewerLoading = ref(false);
const imageViewerHint = ref("");
const imageViewerFile = ref(null);
const appInfo = ref({
  productName: "Linksee Chat",
  version: "",
  electron: window.desktopShell?.versions?.electron || "",
  chrome: window.desktopShell?.versions?.chrome || "",
  node: window.desktopShell?.versions?.node || "",
  storage: null,
});
const standaloneConversationMode = computed(() => (
  isDesktopRuntime() && getDesktopWindowKind() === "chat"
));
const showStandaloneInfoSidebar = computed(() => (
  standaloneConversationMode.value && Boolean(store.selectedConversation.value)
));

let conversationsRefreshTimer = null;
let selectedRefreshTimer = null;
let detachLogs = null;

function scheduleConversationsRefresh() {
  if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
  conversationsRefreshTimer = window.setTimeout(() => {
    actions.loadConversations().catch(() => {});
    conversationsRefreshTimer = null;
  }, 120);
}

function scheduleSelectedRefresh() {
  if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
  selectedRefreshTimer = window.setTimeout(() => {
    actions.refreshSelectedConversation().catch(() => {});
    selectedRefreshTimer = null;
  }, 120);
}

function applyRealtimeProfile(payload) {
  const profile = payload?.profile || {};
  actions.applyUserProfileUpdate(payload?.userId, {
    realName: profile.realName,
    originalRealName: profile.originalRealName || profile.realName,
    bio: profile.bio || "",
    avatarUrl: profile.avatarUrl
      ? appendCacheBust(profile.avatarUrl, profile.avatarVersion || Date.now())
      : "",
  });
}

async function handleRealtimeEvent(event) {
  const topic = String(event?.topic || "");
  const conversationId = String(event?.payload?.conversationId || "");
  if (!topic || topic === "socket.ready") return;
  if (topic === "user.profile.updated") {
    applyRealtimeProfile(event.payload);
    return;
  }
  if (topic === "conversation.message.created") {
    notifyIncomingMessage(conversationId);
  }
  scheduleConversationsRefresh();
  if (conversationId && String(store.selectedId.value) === conversationId) {
    scheduleSelectedRefresh();
  }
}

const realtime = useChatRealtime(auth, store.selectedId, store.conversations, store.socketOnline, handleRealtimeEvent);

function persistSettings(nextSettings) {
  appSettings.value = saveAppSettings(nextSettings);
}

function openSettings() {
  settingsOpen.value = true;
}

function closeSettings() {
  settingsOpen.value = false;
}

function isCurrentConversationFocused(conversationId) {
  return document.visibilityState === "visible"
    && document.hasFocus()
    && String(store.selectedId.value) === String(conversationId);
}

function syncDesktopWindowContext() {
  if (typeof window.desktopShell?.updateWindowContext !== "function") return;
  window.desktopShell.updateWindowContext({
    kind: standaloneConversationMode.value ? "chat" : "main-chat",
    conversationId: String(store.selectedId.value || ""),
  }).catch(() => {});
}

async function notifyIncomingMessage(conversationId) {
  if (!conversationId || !appSettings.value.notifications?.desktopEnabled && !appSettings.value.notifications?.soundEnabled) {
    return;
  }
  if (isCurrentConversationFocused(conversationId)) {
    return;
  }
  const conversation = store.conversations.value.find((item) => String(item.id) === String(conversationId));
  const title = conversation?.title || conversation?.displayTitle || store.chatTitle.value || "新消息";
  const body = conversation?.lastMessage?.content || "你收到一条新消息";

  if (appSettings.value.notifications?.soundEnabled) {
    window.desktopShell?.beep?.();
  }
  if (appSettings.value.notifications?.desktopEnabled) {
    if (typeof window.desktopShell?.showNotification === "function") {
      await window.desktopShell.showNotification({
        title,
        body,
        conversationId,
      }).catch(() => {});
      appendAppLog({ level: "info", category: "notification", message: `已发送桌面提醒：${title}`, meta: body });
      return;
    }
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission().catch(() => "denied");
      }
      if (Notification.permission === "granted") {
        new Notification(title, { body });
        appendAppLog({ level: "info", category: "notification", message: `已发送浏览器提醒：${title}`, meta: body });
      }
    }
  }
}

function handleComposerKeydown(event) {
  if (event.key === "Escape") {
    store.mentionOpen.value = false;
    store.mentionOptions.value = [];
  }
  if (event.key === "Enter" && !event.shiftKey && appSettings.value.general?.sendByEnter !== false) {
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

function handleFileDrop(files) {
  actions.uploadFiles(files || []).catch((error) => {
    store.setComposerHint(error?.message || "上传失败", "error");
  });
}

function handleFilePaste(files) {
  actions.uploadFiles(files || []).catch((error) => {
    store.setComposerHint(error?.message || "粘贴图片失败", "error");
  });
}

function openStickerImport() {
  stickerImportOpen.value = true;
}

async function importStickerFiles() {
  await stickerLibrary.importFiles();
}

async function importStickerFolder() {
  await stickerLibrary.importFolder();
}

async function openStickerFolder() {
  const folder = appInfo.value.storage?.stickers || "";
  if (!folder || typeof window.desktopShell?.openStoragePath !== "function") return;
  await window.desktopShell.openStoragePath(folder).catch(() => {});
}

async function handleSendSticker(sticker) {
  if (!sticker?.src) return;
  try {
    const response = await fetch(sticker.src);
    const blob = await response.blob();
    const extension = blob.type === "image/gif"
      ? "gif"
      : blob.type === "image/webp"
        ? "webp"
        : blob.type === "image/jpeg"
          ? "jpg"
          : "png";
    const file = new File([blob], `${sticker.name || "sticker"}.${extension}`, {
      type: blob.type || "image/png",
      lastModified: Date.now(),
    });
    await actions.uploadFiles([file]);
    stickerLibrary.clearHint();
  } catch (error) {
    store.setComposerHint(error?.message || "表情发送失败", "error");
  }
}

async function openImageViewer(file) {
  if (!file?.objectKey) return;
  imageViewerOpen.value = true;
  imageViewerTitle.value = file.name || "图片预览";
  imageViewerSrc.value = "";
  imageViewerHint.value = "";
  imageViewerLoading.value = true;
  imageViewerFile.value = file;
  try {
    const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`);
    imageViewerSrc.value = window.URL.createObjectURL(blob);
  } catch (error) {
    imageViewerHint.value = error?.message || "图片加载失败";
  } finally {
    imageViewerLoading.value = false;
  }
}

function closeImageViewer() {
  if (imageViewerSrc.value.startsWith("blob:")) {
    window.URL.revokeObjectURL(imageViewerSrc.value);
  }
  imageViewerOpen.value = false;
  imageViewerTitle.value = "";
  imageViewerSrc.value = "";
  imageViewerHint.value = "";
  imageViewerLoading.value = false;
  imageViewerFile.value = null;
}

function clearMessageSearch() {
  store.messageKeyword.value = "";
  store.searchKeyword.value = "";
  actions.refreshSelectedConversation().catch(() => {});
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
    detachLogs = onAppLogsUpdated((logs) => {
      appLogs.value = logs;
    });
    const runtimeInfo = await window.desktopShell?.getAppInfo?.().catch(() => null);
    if (runtimeInfo) {
      appInfo.value = {
        productName: runtimeInfo.productName || "Linksee Chat",
        version: runtimeInfo.version || "",
        electron: runtimeInfo.electron || appInfo.value.electron,
        chrome: runtimeInfo.chrome || appInfo.value.chrome,
        node: runtimeInfo.node || appInfo.value.node,
        storage: runtimeInfo.storage || null,
      };
    }
    await actions.loadProfile(auth);
    await actions.loadContacts();
    await actions.loadConversations();
    await stickerLibrary.refresh();
    if (standaloneConversationMode.value && desktopConversationId) {
      await actions.selectConversation(desktopConversationId);
    } else {
      await actions.refreshSelectedConversation();
    }
    syncDesktopWindowContext();
    realtime.connect();
  } catch (error) {
    store.setComposerHint(error?.message || "聊天初始化失败", "error");
  }
});

onBeforeUnmount(() => {
  if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
  if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
  if (typeof detachLogs === "function") detachLogs();
  realtime.disconnect();
});

watch(() => store.selectedId.value, () => {
  syncDesktopWindowContext();
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
        @open-settings="openSettings"
        @toggle-pin="actions.toggleConversationPinById"
        @logout="logout"
      />

      <MessagePanel
        :chat-title="store.chatTitle.value"
        :chat-subtitle="store.chatSubtitle.value"
        :message-keyword="store.messageKeyword.value"
        :socket-online="store.socketOnline.value"
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
        :uploading-files="store.uploadingFiles.value"
        :upload-progress-text="store.uploadProgressText.value"
        :download-progress-text="store.downloadProgressText.value"
        :has-more-messages="store.hasMoreMessages.value"
        :loading-more-messages="store.loadingMoreMessages.value"
        :standalone-mode="standaloneConversationMode"
        :stickers="stickerLibrary.stickers.value"
        :stickers-loading="stickerLibrary.loading.value"
        :stickers-hint="stickerLibrary.hint.value"
        :stickers-hint-tone="stickerLibrary.hintTone.value"
        @update:message-keyword="store.messageKeyword.value = $event"
        @search="actions.searchMessages"
        @clear-search="clearMessageSearch"
        @announcement="actions.sendAnnouncement"
        @cancel-edit="cancelEdit"
        @update:message-input="store.messageInput.value = $event; store.updateMentionState($event)"
        @message-keydown="handleComposerKeydown"
        @mention-pick="store.applyMention"
        @submit="actions.submitComposer"
        @message-action="actions.handleMessageAction"
        @open-file-picker="openFilePicker"
        @open-sticker-import="openStickerImport"
        @send-sticker="handleSendSticker"
        @file-change="handleFileChange"
        @file-paste="handleFilePaste"
        @file-drop="handleFileDrop"
        @download-file="actions.downloadFile"
        @open-image="openImageViewer"
        @load-more="actions.loadOlderMessages"
      />

      <InfoSidebar
        v-if="!standaloneConversationMode || showStandaloneInfoSidebar"
        :standalone-mode="standaloneConversationMode"
      />
    </section>

    <ToastStack :notifications="store.notifications.value" @dismiss="store.dismissNotification" />

    <SettingsDialog
      :open="settingsOpen"
      :settings="appSettings"
      :profile-name="store.profileName.value"
      :profile-bio="store.profileBio.value"
      :profile-hint="store.profileHint.value"
      :profile-hint-tone="store.profileHintTone.value"
      :me-avatar-url="store.meAvatarUrl.value"
      :app-info="appInfo"
      :logs="appLogs"
      @close="closeSettings"
      @clear-logs="clearAppLogs()"
      @update:settings="persistSettings"
      @update:profile-name="store.profileName.value = $event"
      @update:profile-bio="store.profileBio.value = $event"
      @save-profile="actions.saveProfile"
      @upload-avatar="handleAvatarUpload"
    />

    <StickerImportDialog
      :open="stickerImportOpen"
      :storage="appInfo.storage"
      :hint="stickerLibrary.hint.value"
      :hint-tone="stickerLibrary.hintTone.value"
      @close="stickerImportOpen = false"
      @import-files="importStickerFiles"
      @import-folder="importStickerFolder"
      @open-sticker-folder="openStickerFolder"
    />

    <ImageViewerDialog
      :open="imageViewerOpen"
      :title="imageViewerTitle"
      :src="imageViewerSrc"
      :loading="imageViewerLoading"
      :hint="imageViewerHint"
      @close="closeImageViewer"
      @download="imageViewerFile && actions.downloadFile(imageViewerFile)"
    />

    <ForwardDialog
      :open="store.forwardDialogOpen.value"
      :conversations="store.filteredConversations.value"
      :selected-id="store.forwardConversationId.value"
      :hint="store.forwardHint.value"
      :submitting="store.forwardSubmitting.value"
      @close="store.closeForwardDialog"
      @update:selected-id="store.forwardConversationId.value = $event"
      @submit="actions.submitForwardMessage"
    />

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
