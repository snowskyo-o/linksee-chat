export async function hydrateDesktopRuntime(desktopControls) {
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

export function setupDesktopBindings(state, desktopControls, realtimeRuntime) {
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
