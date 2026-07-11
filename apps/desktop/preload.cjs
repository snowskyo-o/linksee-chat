const { contextBridge, ipcRenderer } = require("electron");

function readServerOrigin() {
  const arg = process.argv.find((item) => String(item).startsWith("--remote-origin="));
  return arg ? String(arg).slice("--remote-origin=".length) : "";
}

contextBridge.exposeInMainWorld("desktopShell", {
  isDesktop: true,
  platform: process.platform,
  serverOrigin: readServerOrigin(),
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
