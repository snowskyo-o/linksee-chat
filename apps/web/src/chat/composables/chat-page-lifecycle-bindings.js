import { watchSystemAppearance } from "../../shared/appearance-mode.js";
import { subscribeAppSettings } from "../../shared/app-settings.js";

export function createChatPageLifecycleBindings({
  auth,
  actions,
  desktopControls,
  desktopConversationId,
  realtime,
  realtimeRuntime,
  reloadConversationList,
  reloadSelectedConversation,
  standaloneConversationMode,
  stickerLibrary,
  store,
  syncDesktopWindowContext,
}) {
  const state = {
    detachAppSettings: null,
    detachDesktopPreferences: null,
    detachOpenConversation: null,
    detachSystemAppearance: null,
    detachUpdateState: null,
  };

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
      state.detachUpdateState = window.desktopShell.onUpdateState((nextState) => desktopControls.applyDesktopUpdateState(nextState));
    }
    if (typeof window.desktopShell?.onDesktopPreferences === "function") {
      state.detachDesktopPreferences = window.desktopShell.onDesktopPreferences((payload) => desktopControls.applyDesktopPreferenceState(payload));
    }
    if (typeof window.desktopShell?.onOpenConversation === "function") {
      state.detachOpenConversation = window.desktopShell.onOpenConversation((payload) => {
        realtimeRuntime.handleDesktopOpenConversation(payload).catch(() => {});
      });
    }
  }

  async function mountLifecycle() {
    desktopControls.syncAppearance();
    window.addEventListener("focus", realtimeRuntime.syncReadStateIfFocused);
    document.addEventListener("visibilitychange", realtimeRuntime.syncReadStateIfFocused);
    state.detachAppSettings = subscribeAppSettings((nextSettings) => {
      desktopControls.appSettings.value = nextSettings;
      desktopControls.syncAppearance();
    });
    state.detachSystemAppearance = watchSystemAppearance(() => {
      if ((desktopControls.appSettings.value.appearance?.themeMode || "system") === "system") desktopControls.syncAppearance();
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
  }

  function unmountLifecycle() {
    window.removeEventListener("focus", realtimeRuntime.syncReadStateIfFocused);
    document.removeEventListener("visibilitychange", realtimeRuntime.syncReadStateIfFocused);
    realtimeRuntime.clearRealtimeTimers();
    if (typeof state.detachUpdateState === "function") state.detachUpdateState();
    if (typeof state.detachDesktopPreferences === "function") state.detachDesktopPreferences();
    if (typeof state.detachOpenConversation === "function") state.detachOpenConversation();
    if (typeof state.detachAppSettings === "function") state.detachAppSettings();
    if (typeof state.detachSystemAppearance === "function") state.detachSystemAppearance();
    if (store.selectedId.value) {
      actions.saveConversationDraft(store.selectedId.value, store.messageInput.value, store.pendingFiles.value).catch(() => {});
    }
    realtime.disconnect();
  }

  return {
    mountLifecycle,
    unmountLifecycle,
  };
}
