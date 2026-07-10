const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopShell", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
  getWindowState: () => ipcRenderer.invoke("desktop:get-window-state"),
  minimize: () => ipcRenderer.invoke("desktop:minimize"),
  toggleMaximize: () => ipcRenderer.invoke("desktop:toggle-maximize"),
  close: () => ipcRenderer.invoke("desktop:close"),
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
