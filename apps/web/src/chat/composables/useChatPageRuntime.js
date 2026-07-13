import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { appendAppLog } from "../../shared/app-log.js";
import { applyAppearanceMode, watchSystemAppearance } from "../../shared/appearance-mode.js";
import { chatApi } from "../../shared/api-client.js";
import { loadAppSettings, saveAppSettings, subscribeAppSettings } from "../../shared/app-settings.js";
import { createObjectUrlFromBlobLike } from "../../shared/blob-source.js";
import { mergeDesktopPreferences } from "../../shared/desktop-preferences.js";
import { playNotificationSound } from "../../shared/notification-sound.js";

export function useChatPageRuntime({
  auth,
  store,
  actions,
  realtime,
  stickerLibrary,
  desktopConversationId,
  standaloneConversationMode,
  selectConversation,
}) {
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
  const hadRealtimeConnected = ref(false);
  const networkBannerText = ref("");
  const showStandaloneInfoSidebar = computed(() => (
    standaloneConversationMode.value && Boolean(store.selectedConversation.value)
  ));
  const unreadTotal = computed(() => store.conversations.value.reduce((sum, row) => {
    return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
  }, 0));
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
  let detachAppSettings = null;
  let detachSystemAppearance = null;
  let draftPersistTimer = null;

  function syncAppearance() {
    applyAppearanceMode(appSettings.value.appearance?.themeMode || "system");
  }

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
    if (payload.storage) appInfo.value = { ...appInfo.value, storage: payload.storage };
  }

  function openSettings() {
    settingsOpen.value = true;
  }

  function closeSettings() {
    settingsOpen.value = false;
  }

  function closeUpdatePrompt() {
    updatePromptOpen.value = false;
  }

  function closeStickerImport() {
    stickerImportOpen.value = false;
  }

  function persistSettings(nextSettings) {
    appSettings.value = saveAppSettings(nextSettings);
    syncAppearance();
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
    if (!conversationId || desktopPreferences.value.notificationsMuted || !appSettings.value.notifications?.desktopEnabled && !appSettings.value.notifications?.soundEnabled) return;
    if (isCurrentConversationFocused(conversationId)) return;
    const conversation = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    const title = conversation?.title || conversation?.displayTitle || store.chatTitle.value || "新消息";
    const body = conversation?.lastMessage?.content || "你收到一条新消息";

    if (appSettings.value.notifications?.soundEnabled) {
      const played = await playNotificationSound().catch(() => false);
      if (!played) window.desktopShell?.beep?.();
    }
    if (appSettings.value.notifications?.desktopEnabled) {
      if (typeof window.desktopShell?.showNotification === "function") {
        await window.desktopShell.showNotification({ title, body, conversationId }).catch(() => {});
        appendAppLog({ level: "info", category: "notification", message: `已发送桌面提醒：${title}`, meta: body });
        return;
      }
      if ("Notification" in window) {
        if (Notification.permission === "default") await Notification.requestPermission().catch(() => "denied");
        if (Notification.permission === "granted") {
          new Notification(title, { body });
          appendAppLog({ level: "info", category: "notification", message: `已发送浏览器提醒：${title}`, meta: body });
        }
      }
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
      actions.refreshSelectedConversation().then(() => syncReadStateIfFocused()).catch(() => {});
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
    if (topic === "conversation.message.created") notifyIncomingMessage(conversationId);
    scheduleConversationsRefresh();
    if (conversationId && String(store.selectedId.value) === conversationId) scheduleSelectedRefresh();
  }

  async function handleDesktopOpenConversation(payload = {}) {
    if (standaloneConversationMode.value) return;
    const conversationId = String(payload.conversationId || "").trim();
    if (!conversationId || conversationId === String(store.selectedId.value || "")) return;
    await selectConversation(conversationId);
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
    actions.queueFiles(event.target?.files || [], { source: "picker" });
  }

  function handleFileDrop(payload) {
    actions.queueFiles(payload?.files || payload || [], {
      source: "drop",
      directoryLike: Number(payload?.directoryLike || 0),
    });
  }

  function handleFilePaste(payload) {
    actions.queueFiles(payload?.files || payload || [], {
      source: "paste",
      ignoredClipboardFiles: Number(payload?.ignoredClipboardFiles || 0),
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

  async function renameSticker(payload) {
    await stickerLibrary.rename(payload?.id, payload?.name);
  }

  async function deleteSticker(stickerId) {
    await stickerLibrary.remove(stickerId);
  }

  async function moveSticker(payload) {
    await stickerLibrary.move(payload?.id, payload?.direction);
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

  async function clearDesktopCache() {
    if (typeof window.desktopShell?.clearCache !== "function") return;
    const payload = await window.desktopShell.clearCache().catch(() => null);
    if (payload?.storage) appInfo.value = { ...appInfo.value, storage: payload.storage };
    const files = Number(payload?.summary?.files || 0);
    const bytes = Number(payload?.summary?.bytes || 0);
    store.pushNotification({
      title: "缓存已清理",
      message: `已清理 ${files} 个缓存文件 · ${Math.round(bytes / 1024)} KB`,
      tone: "success",
      ttl: 2600,
    });
  }

  async function handleSendSticker(sticker) {
    const source = sticker?.originalSrc || sticker?.src || "";
    if (!source) return;
    stickerLibrary.markUsed(sticker);
    try {
      const response = await fetch(source);
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
      if (payload?.canceled) return;
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
      imageViewerSrc.value = await createObjectUrlFromBlobLike(blob, file.mimeType || "image/png");
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
    if (imageViewerSrc.value.startsWith("blob:")) window.URL.revokeObjectURL(imageViewerSrc.value);
    imageViewerOpen.value = false;
    imageViewerTitle.value = "";
    imageViewerSrc.value = "";
    imageViewerHint.value = "";
    imageViewerLoading.value = false;
    imageViewerFile.value = null;
  }

  function handleAvatarUpload(event) {
    const file = event.target?.files?.[0];
    actions.uploadAvatar(file).catch((error) => {
      store.profileHint.value = error?.message || "头像上传失败";
      store.profileHintTone.value = "error";
    });
  }

  function handleComposerKeydown(event) {
    const shortcut = appSettings.value.general?.sendShortcut || "enter";
    if (event.key === "Escape") {
      store.mentionOpen.value = false;
      store.mentionOptions.value = [];
    }
    const shouldSend = event.key === "Enter" && (shortcut === "ctrlEnter" ? event.ctrlKey : !event.shiftKey);
    if (shouldSend) {
      event.preventDefault();
      actions.submitComposer().catch((error) => {
        store.setComposerHint(error?.message || "发送失败", "error");
      });
      return;
    }
    store.updateMentionState();
  }

  onMounted(async () => {
    try {
      syncAppearance();
      window.addEventListener("focus", syncReadStateIfFocused);
      document.addEventListener("visibilitychange", syncReadStateIfFocused);
      detachAppSettings = subscribeAppSettings((nextSettings) => {
        appSettings.value = nextSettings;
        syncAppearance();
      });
      detachSystemAppearance = watchSystemAppearance(() => {
        if ((appSettings.value.appearance?.themeMode || "system") === "system") syncAppearance();
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
          const draft = await actions.loadConversationDraft(store.selectedId.value);
          store.messageInput.value = draft.text || "";
          store.pendingFiles.value = Array.isArray(draft.files) ? draft.files : [];
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
    if (typeof detachAppSettings === "function") detachAppSettings();
    if (typeof detachSystemAppearance === "function") detachSystemAppearance();
    if (store.selectedId.value) {
      actions.saveConversationDraft(store.selectedId.value, store.messageInput.value, store.pendingFiles.value).catch(() => {});
    }
    realtime.disconnect();
  });

  watch(() => store.selectedId.value, () => {
    syncDesktopWindowContext();
  });

  watch(() => store.socketOnline.value, (online, previousOnline) => {
    if (online) {
      hadRealtimeConnected.value = true;
      networkBannerText.value = "";
      return;
    }
    if (previousOnline && hadRealtimeConnected.value) {
      networkBannerText.value = "网络已断开，正在重新连接……";
    }
  });

  watch(unreadTotal, (value) => {
    window.desktopShell?.updateUnreadCount?.(value).catch?.(() => {});
  }, { immediate: true });

  watch(() => [store.selectedId.value, store.messageInput.value], ([conversationId, messageInput]) => {
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (!conversationId) return;
    draftPersistTimer = window.setTimeout(() => {
      actions.saveConversationDraft(conversationId, messageInput, store.pendingFiles.value).catch(() => {});
      draftPersistTimer = null;
    }, 240);
  });

  watch(() => [store.selectedId.value, store.pendingFiles.value.map((item) => `${item.name}:${item.size}:${item.lastModified}`).join("|")], ([conversationId]) => {
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (!conversationId) return;
    draftPersistTimer = window.setTimeout(() => {
      actions.saveConversationDraft(conversationId, store.messageInput.value, store.pendingFiles.value).catch(() => {});
      draftPersistTimer = null;
    }, 240);
  });

  watch(() => [appSettings.value.files?.autoReceiveImages, store.renderedMessages.value.map((message) => message.id).join("|")], ([enabled]) => {
    if (!enabled || !window.desktopShell?.isDesktop) return;
    const imageFiles = store.renderedMessages.value.flatMap((message) => message.files || []).filter((file) => file?.isImage);
    actions.autoReceiveImages?.(imageFiles).catch?.(() => {});
  }, { immediate: true });

  return {
    appInfo,
    appSettings,
    checkForUpdates,
    chooseDownloadDirectory,
    clearDesktopCache,
    clearMessageSearch,
    closeImageViewer,
    closeSettings,
    closeStickerImport,
    closeUpdatePrompt,
    copyImageFromViewer,
    desktopPreferences,
    handleAvatarUpload,
    handleComposerKeydown,
    handleFileChange,
    handleFileDrop,
    handleFilePaste,
    handleRealtimeEvent,
    handleSendSticker,
    handleUpdateNow,
    imageViewerActiveFile,
    imageViewerHint,
    imageViewerLoading,
    imageViewerOpen,
    imageViewerOwnerMessageId,
    imageViewerSrc,
    imageViewerStatusText,
    imageViewerTitle,
    importStickerFiles,
    importStickerFolder,
    moveSticker,
    networkBannerText,
    openDownloadDirectory,
    openFilePicker,
    openImageLocationFromViewer,
    openImageViewer,
    openSettings,
    openStickerFolder,
    openStickerImport,
    persistDesktopPreferences,
    persistSettings,
    reloadConversationList,
    reloadSelectedConversation,
    remindUpdateLater,
    renameSticker,
    saveImageFromViewer,
    settingsOpen,
    showStandaloneInfoSidebar,
    stickerImportOpen,
    updatePromptOpen,
    deleteSticker,
    forwardImageFromViewer,
    captureScreenshot,
  };
}
