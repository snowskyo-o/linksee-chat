import { onBeforeUnmount, onMounted, watch } from "vue";
import { watchSystemAppearance } from "../../shared/appearance-mode.js";
import { subscribeAppSettings } from "../../shared/app-settings.js";

export function useChatPageLifecycle({
  auth,
  store,
  actions,
  realtime,
  stickerLibrary,
  desktopConversationId,
  standaloneConversationMode,
  desktopControls,
  mediaControls,
  realtimeRuntime,
  syncDesktopWindowContext,
  reloadConversationList,
  reloadSelectedConversation,
}) {
  let detachUpdateState = null;
  let detachDesktopPreferences = null;
  let detachOpenConversation = null;
  let detachAppSettings = null;
  let detachSystemAppearance = null;
  let draftPersistTimer = null;

  async function hydrateDesktopRuntime() {
    const runtimeInfo = await window.desktopShell?.getAppInfo?.().catch(() => null);
    if (!runtimeInfo) return;
    desktopControls.appInfo.value = {
      productName: runtimeInfo.productName || "Linksee Chat",
      version: runtimeInfo.version || "",
      electron: runtimeInfo.electron || desktopControls.appInfo.value.electron,
      chrome: runtimeInfo.chrome || desktopControls.appInfo.value.chrome,
      node: runtimeInfo.node || desktopControls.appInfo.value.node,
      storage: runtimeInfo.storage || null,
    };
    desktopControls.applyDesktopPreferenceState(runtimeInfo);
  }

  async function hydrateInitialConversation() {
    if (standaloneConversationMode.value && desktopConversationId) {
      await actions.selectConversation(desktopConversationId).catch(() => {});
      return;
    }
    await reloadSelectedConversation();
    if (!store.selectedId.value) return;
    const draft = await actions.loadConversationDraft(store.selectedId.value);
    store.messageInput.value = draft.text || "";
    store.pendingFiles.value = Array.isArray(draft.files) ? draft.files : [];
    store.updateMentionState(store.messageInput.value);
  }

  function setupDesktopBindings() {
    if (typeof window.desktopShell?.onUpdateState === "function") {
      detachUpdateState = window.desktopShell.onUpdateState((state) => desktopControls.applyDesktopUpdateState(state));
    }
    if (typeof window.desktopShell?.onDesktopPreferences === "function") {
      detachDesktopPreferences = window.desktopShell.onDesktopPreferences((payload) => desktopControls.applyDesktopPreferenceState(payload));
    }
    if (typeof window.desktopShell?.onOpenConversation === "function") {
      detachOpenConversation = window.desktopShell.onOpenConversation((payload) => {
        realtimeRuntime.handleDesktopOpenConversation(payload).catch(() => {});
      });
    }
  }

  onMounted(async () => {
    try {
      desktopControls.syncAppearance();
      window.addEventListener("focus", realtimeRuntime.syncReadStateIfFocused);
      document.addEventListener("visibilitychange", realtimeRuntime.syncReadStateIfFocused);
      detachAppSettings = subscribeAppSettings((nextSettings) => {
        desktopControls.appSettings.value = nextSettings;
        desktopControls.syncAppearance();
      });
      detachSystemAppearance = watchSystemAppearance(() => {
        if ((desktopControls.appSettings.value.appearance?.themeMode || "system") === "system") {
          desktopControls.syncAppearance();
        }
      });
      await hydrateDesktopRuntime();
      setupDesktopBindings();
      await actions.loadProfile(auth);
      await actions.loadContacts().catch(() => {});
      await reloadConversationList();
      await stickerLibrary.refresh();
      await hydrateInitialConversation();
      syncDesktopWindowContext();
      realtime.connect();
      desktopControls.checkForUpdates().catch(() => {});
    } catch (error) {
      store.setComposerHint(error?.message || "聊天初始化失败", "error");
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener("focus", realtimeRuntime.syncReadStateIfFocused);
    document.removeEventListener("visibilitychange", realtimeRuntime.syncReadStateIfFocused);
    realtimeRuntime.clearRealtimeTimers();
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
    realtimeRuntime.handleSocketOnlineChange(online, previousOnline);
  });

  watch(realtimeRuntime.unreadTotal, (value) => {
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

  watch(() => [desktopControls.appSettings.value.files?.autoReceiveImages, store.renderedMessages.value.map((message) => message.id).join("|")], ([enabled]) => {
    if (!enabled || !window.desktopShell?.isDesktop) return;
    const imageFiles = store.renderedMessages.value.flatMap((message) => message.files || []).filter((file) => file?.isImage);
    actions.autoReceiveImages?.(imageFiles).catch?.(() => {});
  }, { immediate: true });

  return {
    mediaControls,
  };
}
