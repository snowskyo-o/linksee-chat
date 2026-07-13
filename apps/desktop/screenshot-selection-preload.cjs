const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotSelection", {
  complete: (payload) => ipcRenderer.invoke("desktop:complete-screenshot-selection", payload),
  cancel: () => ipcRenderer.invoke("desktop:cancel-screenshot-selection"),
});
