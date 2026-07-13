function registerDesktopInfoIpc(ipcMain, deps) {
  const {
    app,
    autoUpdater,
    getDesktopPreferences,
    getStorageInfo,
    markAppQuitting,
    publishUpdateState,
    targetOrigin,
    updateDesktopPreferences,
    updateStateRef,
  } = deps;

  ipcMain.handle("desktop:get-runtime-config", () => ({ serverOrigin: targetOrigin }));
  ipcMain.handle("desktop:get-app-info", () => ({
    productName: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    storage: getStorageInfo(),
    desktopPreferences: getDesktopPreferences(),
  }));
  ipcMain.handle("desktop:get-preferences", () => ({
    preferences: getDesktopPreferences(),
    storage: getStorageInfo(),
  }));
  ipcMain.handle("desktop:update-preferences", (_event, patch = {}) => updateDesktopPreferences(patch));
  ipcMain.handle("desktop:get-update-state", () => updateStateRef());
  ipcMain.handle("desktop:check-for-updates", async () => {
    if (!app.isPackaged) {
      return publishUpdateState({ status: "unavailable", available: false, error: "开发模式不执行自动更新" });
    }
    await autoUpdater.checkForUpdates();
    return updateStateRef();
  });
  ipcMain.handle("desktop:download-update", async () => {
    if (!app.isPackaged) return updateStateRef();
    publishUpdateState({ status: "downloading", error: "" });
    await autoUpdater.downloadUpdate();
    return updateStateRef();
  });
  ipcMain.handle("desktop:install-update", () => {
    const updateState = updateStateRef();
    if (!app.isPackaged || !updateState.downloaded) return updateState;
    markAppQuitting();
    publishUpdateState({ status: "installing", error: "" });
    autoUpdater.quitAndInstall(false, true);
    return updateStateRef();
  });
}

module.exports = {
  registerDesktopInfoIpc,
};
