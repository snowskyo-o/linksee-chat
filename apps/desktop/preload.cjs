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
  getWindowState: () => ipcRenderer.invoke("desktop:get-window-state"),
  minimize: () => ipcRenderer.invoke("desktop:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("desktop:toggle-maximize"),
  close: () => ipcRenderer.invoke("desktop:close"),
  loginSuccess: () => ipcRenderer.invoke("desktop:login-success"),
  openChatWindow: (conversationId) => ipcRenderer.invoke("desktop:open-chat-window", conversationId),
  logoutToLogin: () => ipcRenderer.invoke("desktop:logout"),
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
});
