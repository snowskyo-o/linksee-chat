const { contextBridge, ipcRenderer } = require("electron");

function readArgument(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((item) => String(item).startsWith(prefix));
  return arg ? String(arg).slice(prefix.length) : "";
}

contextBridge.exposeInMainWorld("desktopShell", {
  isDesktop: true,
  platform: process.platform,
  serverOrigin: readArgument("remote-origin"),
  windowKind: readArgument("window-kind"),
  conversationId: readArgument("conversation-id"),
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  getRuntimeConfig: () => ipcRenderer.invoke("desktop:get-runtime-config"),
  getAppInfo: () => ipcRenderer.invoke("desktop:get-app-info"),
  getDesktopPreferences: () => ipcRenderer.invoke("desktop:get-preferences"),
  updateDesktopPreferences: (patch) => ipcRenderer.invoke("desktop:update-preferences", patch),
  getUpdateState: () => ipcRenderer.invoke("desktop:get-update-state"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("desktop:download-update"),
  installUpdate: () => ipcRenderer.invoke("desktop:install-update"),
  updateWindowContext: (payload) => ipcRenderer.invoke("desktop:update-window-context", payload),
  resolveAvatarSource: (sourceUrl) => ipcRenderer.invoke("desktop:resolve-avatar-source", sourceUrl),
  saveDownloadedFile: (payload) => ipcRenderer.invoke("desktop:save-downloaded-file", payload),
  readStateCache: (payload) => ipcRenderer.invoke("desktop:read-state-cache", payload),
  writeStateCache: (payload) => ipcRenderer.invoke("desktop:write-state-cache", payload),
  openStoragePath: (targetPath) => ipcRenderer.invoke("desktop:open-storage-path", targetPath),
  chooseDirectory: (options) => ipcRenderer.invoke("desktop:choose-directory", options),
  listStickers: () => ipcRenderer.invoke("desktop:list-stickers"),
  importStickerFiles: () => ipcRenderer.invoke("desktop:import-sticker-files"),
  importStickerFolder: () => ipcRenderer.invoke("desktop:import-sticker-folder"),
  getWindowState: () => ipcRenderer.invoke("desktop:get-window-state"),
  minimize: () => ipcRenderer.invoke("desktop:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("desktop:toggle-maximize"),
  close: () => ipcRenderer.invoke("desktop:close"),
  loginSuccess: () => ipcRenderer.invoke("desktop:login-success"),
  openChatWindow: (conversationId) => ipcRenderer.invoke("desktop:open-chat-window", conversationId),
  logoutToLogin: () => ipcRenderer.invoke("desktop:logout"),
  showNotification: (payload) => ipcRenderer.invoke("desktop:show-notification", payload),
  beep: () => ipcRenderer.invoke("desktop:beep"),
  updateUnreadCount: (count) => ipcRenderer.invoke("desktop:update-unread-count", count),
  onWindowState(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    const handler = (_event, state) => callback(state || {});
    ipcRenderer.on("desktop:window-state", handler);
    return () => {
      ipcRenderer.removeListener("desktop:window-state", handler);
    };
  },
  onUpdateState(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    const handler = (_event, state) => callback(state || {});
    ipcRenderer.on("desktop:update-state", handler);
    return () => {
      ipcRenderer.removeListener("desktop:update-state", handler);
    };
  },
  onDesktopPreferences(callback) {
    if (typeof callback !== "function") {
      return () => {};
    }
    const handler = (_event, payload) => callback(payload || {});
    ipcRenderer.on("desktop:preferences-changed", handler);
    return () => {
      ipcRenderer.removeListener("desktop:preferences-changed", handler);
    };
  },
});
