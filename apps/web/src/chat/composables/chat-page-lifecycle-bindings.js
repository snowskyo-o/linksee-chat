import { watchSystemAppearance } from "../../shared/appearance-mode.js";
import { subscribeAppSettings } from "../../shared/app-settings.js";
import { setupDesktopBindings, hydrateDesktopRuntime } from "./chat-page-lifecycle-desktop.js";
import { hydrateInitialConversation } from "./chat-page-lifecycle-hydration.js";

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
    await hydrateDesktopRuntime(desktopControls);
    setupDesktopBindings(state, desktopControls, realtimeRuntime);
    await actions.loadProfile(auth);
    await actions.loadContacts().catch(() => {});
    await reloadConversationList();
    await stickerLibrary.refresh();
    await hydrateInitialConversation({
      actions,
      desktopConversationId,
      reloadSelectedConversation,
      standaloneConversationMode,
      store,
    });
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
