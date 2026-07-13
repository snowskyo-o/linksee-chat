export function createInitialAppInfo() {
  return {
    productName: "Linksee Chat",
    version: "",
    electron: window.desktopShell?.versions?.electron || "",
    chrome: window.desktopShell?.versions?.chrome || "",
    node: window.desktopShell?.versions?.node || "",
    storage: null,
  };
}

export function normalizeDesktopUpdateState(state = {}) {
  return {
    native: true,
    hasUpdate: Boolean(state.available),
    latestVersion: state.version || "",
    mandatory: false,
    downloaded: Boolean(state.downloaded),
    progress: Number(state.progress || 0),
    status: state.status || "idle",
    error: state.error || "",
  };
}
