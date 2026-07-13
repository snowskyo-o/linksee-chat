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
import UpdatePromptDialog from "./components/UpdatePromptDialog.vue";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { appendAppLog } from "../shared/app-log.js";
import { chatApi } from "../shared/api-client.js";
import { getAuth, logout } from "../shared/session.js";
import { loadAppSettings, saveAppSettings } from "../shared/app-settings.js";
import { mergeDesktopPreferences } from "../shared/desktop-preferences.js";
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
const desktopPreferences = ref(mergeDesktopPreferences());
const stickerImportOpen = ref(false);
const imageViewerOpen = ref(false);
const imageViewerTitle = ref("");
const imageViewerSrc = ref("");
const imageViewerLoading = ref(false);
const imageViewerHint = ref("");
const imageViewerFile = ref(null);
const updatePromptOpen = ref(false);
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
const unreadTotal = computed(() => store.conversations.value.reduce((sum, row) => {
  return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
}, 0));
const hadRealtimeConnected = ref(false);
const networkBannerText = ref("");
const imageViewerActiveFile = computed(() => {
  const objectKey = String(imageViewerFile.value?.objectKey || "").trim();
  if (!objectKey) return imageViewerFile.value;
  for (const message of store.renderedMessages.value) {
    const matched = (message.files || []).find((file) => String(file.objectKey || "") === objectKey);
    if (matched) return matched;
  }
  return imageViewerFile.value;
});
const imageViewerOwnerMessageId = computed(() => {
  const objectKey = String(imageViewerActiveFile.value?.objectKey || imageViewerFile.value?.objectKey || "").trim();
  if (!objectKey) return "";
  const owner = store.renderedMessages.value.find((message) => (
    Array.isArray(message.files) && message.files.some((file) => String(file.objectKey || "") === objectKey)
  ));
  return String(owner?.id || "");
});
const imageViewerStatusText = computed(() => {
  const transfer = imageViewerActiveFile.value?.transfer || null;
  if (imageViewerLoading.value) return "正在加载";
  if (transfer?.status === "downloading") return `下载中 ${transfer.progress || 0}%`;
  if (transfer?.status === "saving") return "正在保存到本地";
  if (transfer?.status === "saved") return transfer.path ? "已保存，可打开位置" : "已保存";
  if (transfer?.status === "failed") return transfer.error || "保存失败";
  return imageViewerHint.value || "";
});

let conversationsRefreshTimer = null;
let selectedRefreshTimer = null;
let detachUpdateState = null;
let detachDesktopPreferences = null;
let detachOpenConversation = null;
let draftPersistTimer = null;

function updateReminderKey(version) {
  return `linksee_update_remind_after_${String(version || "latest")}`;
}

function shouldShowUpdatePrompt(update) {
  if (!update?.hasUpdate) return false;
  if (update.mandatory) return true;
  const remindAfter = Number(window.localStorage.getItem(updateReminderKey(update.latestVersion)) || 0);
  return Date.now() >= remindAfter;
}

function applyDesktopUpdateState(state = {}) {
  const update = {
    native: true,
    hasUpdate: Boolean(state.available),
    latestVersion: state.version || "",
    mandatory: false,
    downloaded: Boolean(state.downloaded),
    progress: Number(state.progress || 0),
    status: state.status || "idle",
    error: state.error || "",
  };
  appInfo.value = { ...appInfo.value, update };
  updatePromptOpen.value = shouldShowUpdatePrompt(update);
}

function applyDesktopPreferenceState(payload = {}) {
  desktopPreferences.value = mergeDesktopPreferences(payload.preferences || payload.desktopPreferences);
  if (payload.storage) {
    appInfo.value = { ...appInfo.value, storage: payload.storage };
  }
}

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
    actions.refreshSelectedConversation()
      .then(() => syncReadStateIfFocused())
      .catch(() => {});
    selectedRefreshTimer = null;
  }, 120);
}

async function handleRealtimeEvent(event) {
  const topic = String(event?.topic || "");
  const conversationId = String(event?.payload?.conversationId || "");
  if (!topic || topic === "socket.ready") return;
  if (topic === "user.profile.dirty") {
    actions.markProfileDirty(event.payload?.userId);
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

async function persistDesktopPreferences(nextPreferences) {
  if (typeof window.desktopShell?.updateDesktopPreferences !== "function") {
    desktopPreferences.value = mergeDesktopPreferences(nextPreferences);
    return;
  }
  const payload = await window.desktopShell.updateDesktopPreferences(nextPreferences).catch(() => null);
  if (payload) {
    applyDesktopPreferenceState(payload);
    return;
  }
  desktopPreferences.value = mergeDesktopPreferences(nextPreferences);
}

function openSettings() {
  settingsOpen.value = true;
}

function closeSettings() {
  settingsOpen.value = false;
}

async function checkForUpdates() {
  const currentVersion = appInfo.value.version || "";
  if (!currentVersion) return;
  if (typeof window.desktopShell?.checkForUpdates === "function") {
    const state = await window.desktopShell.checkForUpdates().catch((error) => ({
      status: "error",
      error: error?.message || "检查更新失败",
    }));
    applyDesktopUpdateState(state);
    return;
  }
  const payload = await chatApi.getJson(`/api/v1/updates/latest?currentVersion=${encodeURIComponent(currentVersion)}`).catch(() => null);
  if (payload?.data) {
    appInfo.value = { ...appInfo.value, update: payload.data };
    updatePromptOpen.value = shouldShowUpdatePrompt(payload.data);
  }
}

async function handleUpdateNow() {
  const update = appInfo.value.update || {};
  if (update.native && typeof window.desktopShell?.downloadUpdate === "function") {
    if (update.downloaded && typeof window.desktopShell?.installUpdate === "function") {
      await window.desktopShell.installUpdate();
      return;
    }
    updatePromptOpen.value = true;
    const state = await window.desktopShell.downloadUpdate().catch((error) => ({
      ...update,
      status: "error",
      error: error?.message || "下载更新失败",
    }));
    applyDesktopUpdateState(state);
    return;
  }
  appInfo.value = {
    ...appInfo.value,
    update: {
      ...update,
      status: "error",
      error: "当前客户端不支持自动更新，请安装正式桌面版后重试",
    },
  };
  updatePromptOpen.value = true;
}

function remindUpdateLater() {
  const update = appInfo.value.update || {};
  const remindAfter = Date.now() + 6 * 60 * 60 * 1000;
  window.localStorage.setItem(updateReminderKey(update.latestVersion), String(remindAfter));
  updatePromptOpen.value = false;
}

function isCurrentConversationFocused(conversationId) {
  return document.visibilityState === "visible"
    && document.hasFocus()
    && String(store.selectedId.value) === String(conversationId);
}

function syncReadStateIfFocused() {
  if (!isCurrentConversationFocused(store.selectedId.value)) return Promise.resolve();
  return actions.markConversationReadIfNeeded?.().catch(() => {});
}

function syncDesktopWindowContext() {
  if (typeof window.desktopShell?.updateWindowContext !== "function") return;
  window.desktopShell.updateWindowContext({
    kind: standaloneConversationMode.value ? "chat" : "main-chat",
    conversationId: String(store.selectedId.value || ""),
  }).catch(() => {});
}

async function notifyIncomingMessage(conversationId) {
  if (!conversationId || desktopPreferences.value.notificationsMuted || !appSettings.value.notifications?.desktopEnabled && !appSettings.value.notifications?.soundEnabled) {
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
  const shortcut = appSettings.value.general?.sendShortcut || "enter";
  if (event.key === "Escape") {
    store.mentionOpen.value = false;
    store.mentionOptions.value = [];
  }
  const shouldSend = event.key === "Enter" && (
    shortcut === "ctrlEnter"
      ? event.ctrlKey
      : !event.shiftKey
  );
  if (shouldSend) {
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

async function handleDesktopOpenConversation(payload = {}) {
  if (standaloneConversationMode.value) return;
  const conversationId = String(payload.conversationId || "").trim();
  if (!conversationId || conversationId === String(store.selectedId.value || "")) return;
  await selectConversation(conversationId);
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
  actions.queueFiles(event.target?.files || []);
}

function handleFileDrop(files) {
  actions.queueFiles(files || []);
}

function handleFilePaste(files) {
  actions.queueFiles(files || []);
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

async function chooseDownloadDirectory() {
  if (typeof window.desktopShell?.chooseDirectory !== "function") return;
  const folder = await window.desktopShell.chooseDirectory({
    title: "选择下载保存目录",
    defaultPath: desktopPreferences.value.downloadsDir || appInfo.value.storage?.exports || "",
  }).catch(() => "");
  if (!folder) return;
  await persistDesktopPreferences({
    ...desktopPreferences.value,
    downloadsDir: folder,
  });
}

async function openDownloadDirectory() {
  const folder = desktopPreferences.value.downloadsDir || appInfo.value.storage?.exports || "";
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

async function captureScreenshot() {
  if (typeof window.desktopShell?.captureScreenshot !== "function") {
    store.setComposerHint("当前环境不支持截图发送", "error");
    return;
  }
  try {
    const payload = await window.desktopShell.captureScreenshot();
    const bytes = new Uint8Array(Array.isArray(payload?.bytes) ? payload.bytes : []);
    if (!bytes.length) throw new Error("截图结果为空");
    const file = new File([bytes], payload?.fileName || `截图-${Date.now()}.png`, {
      type: payload?.mimeType || "image/png",
      lastModified: Date.now(),
    });
    await actions.uploadFiles([file]);
  } catch (error) {
    store.setComposerHint(error?.message || "截图发送失败", "error");
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

function forwardImageFromViewer() {
  if (!imageViewerOwnerMessageId.value) {
    store.setComposerHint("当前图片暂时无法转发", "error");
    return;
  }
  store.openForwardDialog(imageViewerOwnerMessageId.value);
}

function withViewerFile(task, fallbackMessage) {
  const file = imageViewerActiveFile.value;
  if (!file) {
    store.setComposerHint(fallbackMessage, "error");
    return Promise.resolve();
  }
  return Promise.resolve(task(file)).catch((error) => {
    store.setComposerHint(error?.message || fallbackMessage, "error");
  });
}

function saveImageFromViewer() {
  return withViewerFile((file) => actions.downloadFile(file), "保存图片失败");
}

function copyImageFromViewer() {
  return withViewerFile((file) => actions.copyImageToClipboard(file), "复制图片失败");
}

function openImageLocationFromViewer() {
  return withViewerFile((file) => actions.openFileLocation(file), "打开文件位置失败");
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

async function reloadConversationList() {
  await actions.loadConversations().catch((error) => {
    store.pushNotification({ title: "加载失败", message: error?.message || "暂时无法获取会话列表", tone: "error" });
  });
}

async function reloadSelectedConversation() {
  if (!store.selectedId.value) return;
  await actions.refreshSelectedConversation().catch((error) => {
    store.setComposerHint(error?.message || "暂时无法获取聊天内容", "error");
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
    window.addEventListener("focus", syncReadStateIfFocused);
    document.addEventListener("visibilitychange", syncReadStateIfFocused);
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
      applyDesktopPreferenceState(runtimeInfo);
    }
    if (typeof window.desktopShell?.onUpdateState === "function") {
      detachUpdateState = window.desktopShell.onUpdateState((state) => applyDesktopUpdateState(state));
    }
    if (typeof window.desktopShell?.onDesktopPreferences === "function") {
      detachDesktopPreferences = window.desktopShell.onDesktopPreferences((payload) => applyDesktopPreferenceState(payload));
    }
    if (typeof window.desktopShell?.onOpenConversation === "function") {
      detachOpenConversation = window.desktopShell.onOpenConversation((payload) => {
        handleDesktopOpenConversation(payload).catch(() => {});
      });
    }
    await actions.loadProfile(auth);
    await actions.loadContacts().catch(() => {});
    await reloadConversationList();
    await stickerLibrary.refresh();
    if (standaloneConversationMode.value && desktopConversationId) {
      await actions.selectConversation(desktopConversationId).catch(() => {});
    } else {
      await reloadSelectedConversation();
      if (store.selectedId.value) {
        store.messageInput.value = await actions.loadConversationDraft(store.selectedId.value);
        store.updateMentionState(store.messageInput.value);
      }
    }
    syncDesktopWindowContext();
    realtime.connect();
    checkForUpdates().catch(() => {});
  } catch (error) {
    store.setComposerHint(error?.message || "聊天初始化失败", "error");
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("focus", syncReadStateIfFocused);
  document.removeEventListener("visibilitychange", syncReadStateIfFocused);
  if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
  if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
  if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
  if (typeof detachUpdateState === "function") detachUpdateState();
  if (typeof detachDesktopPreferences === "function") detachDesktopPreferences();
  if (typeof detachOpenConversation === "function") detachOpenConversation();
  if (store.selectedId.value) {
    actions.saveConversationDraft(store.selectedId.value, store.messageInput.value).catch(() => {});
  }
  realtime.disconnect();
});

watch(() => store.selectedId.value, () => {
  syncDesktopWindowContext();
});

watch(
  () => store.socketOnline.value,
  (online, previousOnline) => {
    if (online) {
      hadRealtimeConnected.value = true;
      networkBannerText.value = "";
      return;
    }
    if (previousOnline && hadRealtimeConnected.value) {
      networkBannerText.value = "网络已断开，正在重新连接……";
    }
  },
);

watch(
  unreadTotal,
  (value) => {
    window.desktopShell?.updateUnreadCount?.(value).catch?.(() => {});
  },
  { immediate: true },
);

watch(
  () => [store.selectedId.value, store.messageInput.value],
  ([conversationId, messageInput]) => {
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (!conversationId) return;
    draftPersistTimer = window.setTimeout(() => {
      actions.saveConversationDraft(conversationId, messageInput).catch(() => {});
      draftPersistTimer = null;
    }, 240);
  },
);
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
        :load-state="store.conversationLoadState.value"
        @update:keyword="store.conversationKeyword.value = $event"
        @select="selectConversation"
        @refresh="actions.refreshAll"
        @new-direct="actions.createDirectConversation"
        @new-group="actions.createGroupConversation"
        @open-settings="openSettings"
        @toggle-pin="actions.toggleConversationPinById"
        @logout="logout"
        @retry-load="reloadConversationList"
      />

      <MessagePanel
        :chat-title="store.chatTitle.value"
        :chat-subtitle="store.chatSubtitle.value"
        :chat-kind="store.selectedConversation.value?.kind || ''"
        :has-conversation="Boolean(store.selectedConversation.value)"
        :participant-count="store.selectedConversation.value?.participantIds?.length || store.participants.value.length"
        :message-keyword="store.messageKeyword.value"
        :socket-online="store.socketOnline.value"
        :network-banner-text="networkBannerText"
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
        :stickers-loading="stickerLibrary.loading.value"
        :stickers-hint="stickerLibrary.hint.value"
        :stickers-hint-tone="stickerLibrary.hintTone.value"
        @update:message-keyword="store.messageKeyword.value = $event"
        @search="actions.searchMessages"
        @clear-search="clearMessageSearch"
        @cancel-edit="cancelEdit"
        @update:message-input="store.messageInput.value = $event; store.updateMentionState($event)"
        @message-keydown="handleComposerKeydown"
        @mention-pick="store.applyMention"
        @submit="actions.submitComposer"
        @message-action="actions.handleMessageAction"
        @open-file-picker="openFilePicker"
        @capture-screenshot="captureScreenshot"
        @open-sticker-import="openStickerImport"
        @send-sticker="handleSendSticker"
        @file-change="handleFileChange"
        @file-paste="handleFilePaste"
        @file-drop="handleFileDrop"
        @remove-pending-file="store.removePendingFile"
        @download-file="actions.downloadFile"
        @save-file-as="actions.saveFileAs"
        @open-file="actions.openFile"
        @open-file-location="actions.openFileLocation"
        @copy-image="actions.copyImageToClipboard"
        @open-image="openImageViewer"
        @load-more="actions.loadOlderMessages"
        @retry-load="reloadSelectedConversation"
      />

      <InfoSidebar
        v-if="!standaloneConversationMode || showStandaloneInfoSidebar"
        :standalone-mode="standaloneConversationMode"
      />
    </section>

    <ToastStack :notifications="store.notifications.value" @dismiss="store.dismissNotification" />

    <UpdatePromptDialog
      :open="updatePromptOpen"
      :update="appInfo.update"
      @update-now="handleUpdateNow"
      @remind-later="remindUpdateLater"
      @close="updatePromptOpen = false"
    />

    <SettingsDialog
      :open="settingsOpen"
      :settings="appSettings"
      :desktop-preferences="desktopPreferences"
      :profile-name="store.profileName.value"
      :profile-bio="store.profileBio.value"
      :profile-hint="store.profileHint.value"
      :profile-hint-tone="store.profileHintTone.value"
      :me-avatar-url="store.meAvatarUrl.value"
      :app-info="appInfo"
      @close="closeSettings"
      @update:settings="persistSettings"
      @update:desktop-preferences="persistDesktopPreferences"
      @update:profile-name="store.profileName.value = $event"
      @update:profile-bio="store.profileBio.value = $event"
      @save-profile="actions.saveProfile"
      @upload-avatar="handleAvatarUpload"
      @choose-download-dir="chooseDownloadDirectory"
      @open-download-dir="openDownloadDirectory"
      @open-update="handleUpdateNow"
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
      :status-text="imageViewerStatusText"
      :can-download="Boolean(imageViewerActiveFile?.objectKey)"
      :can-copy="Boolean(imageViewerActiveFile?.objectKey)"
      :can-forward="Boolean(imageViewerOwnerMessageId)"
      :can-open-location="Boolean(imageViewerActiveFile?.transfer?.status === 'saved' && imageViewerActiveFile?.transfer?.path)"
      @close="closeImageViewer"
      @download="saveImageFromViewer"
      @copy="copyImageFromViewer"
      @forward="forwardImageFromViewer"
      @open-location="openImageLocationFromViewer"
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
