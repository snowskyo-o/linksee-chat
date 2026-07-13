import { onBeforeUnmount, onMounted, watch } from "vue";
import { subscribeAppSettings } from "../../shared/app-settings.js";
import { watchSystemAppearance } from "../../shared/appearance-mode.js";

export function useConversationListLifecycle({
  actions,
  auth,
  desktopControls,
  friendCenter,
  handleDesktopOpenConversation,
  handleGlobalPointer,
  quickCreateOpen,
  realtime,
  reloadConversationList,
  searchKeyword,
  unreadTotal,
}) {
  let detachUpdateState = null;
  let detachDesktopPreferences = null;
  let detachOpenConversation = null;
  let detachAppSettings = null;
  let detachSystemAppearance = null;
  let friendSearchTimer = 0;

  onMounted(async () => {
    desktopControls.syncAppearance();
    window.addEventListener("pointerdown", handleGlobalPointer);
    detachAppSettings = subscribeAppSettings((nextSettings) => {
      desktopControls.appSettings.value = nextSettings;
      desktopControls.syncAppearance();
    });
    detachSystemAppearance = watchSystemAppearance(() => {
      if ((desktopControls.appSettings.value.appearance?.themeMode || "system") === "system") desktopControls.syncAppearance();
    });
    const runtimeInfo = await window.desktopShell?.getAppInfo?.().catch(() => null);
    if (runtimeInfo) {
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
    if (typeof window.desktopShell?.onUpdateState === "function") {
      detachUpdateState = window.desktopShell.onUpdateState((state) => desktopControls.applyDesktopUpdateState(state));
    }
    if (typeof window.desktopShell?.onDesktopPreferences === "function") {
      detachDesktopPreferences = window.desktopShell.onDesktopPreferences((payload) => desktopControls.applyDesktopPreferenceState(payload));
    }
    if (typeof window.desktopShell?.onOpenConversation === "function") {
      detachOpenConversation = window.desktopShell.onOpenConversation((payload) => {
        handleDesktopOpenConversation(payload).catch(() => {});
      });
    }
    await actions.loadProfile(auth);
    await actions.loadContacts();
    await reloadConversationList();
    await friendCenter.refresh();
    realtime.connect();
    desktopControls.checkForUpdates().catch(() => {});
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleGlobalPointer);
    if (typeof detachUpdateState === "function") detachUpdateState();
    if (typeof detachDesktopPreferences === "function") detachDesktopPreferences();
    if (typeof detachOpenConversation === "function") detachOpenConversation();
    if (typeof detachAppSettings === "function") detachAppSettings();
    if (typeof detachSystemAppearance === "function") detachSystemAppearance();
    window.clearTimeout(friendSearchTimer);
    realtime.disconnect();
  });

  watch(unreadTotal, (value) => {
    window.desktopShell?.updateUnreadCount?.(value).catch?.(() => {});
  }, { immediate: true });

  watch(searchKeyword, (value) => {
    if (value) quickCreateOpen.value = false;
  });

  watch(() => friendCenter.keyword.value, () => {
    window.clearTimeout(friendSearchTimer);
    friendSearchTimer = window.setTimeout(() => {
      if (friendCenter.open.value) friendCenter.refresh();
    }, 180);
  });
}
