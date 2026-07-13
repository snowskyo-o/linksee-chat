const fs = require("node:fs");
const path = require("node:path");
const { ipcMain } = require("electron");

function registerDesktopIpcHandlers(deps) {
  const {
    STICKER_EXTENSIONS,
    app,
    autoUpdater,
    buildTrayMenu,
    buildTrayTooltip,
    clearDesktopCaches,
    copyStickerIntoLibrary,
    createChatWindow,
    createListWindow,
    createLoginWindow,
    deleteStickerEntry,
    dialog,
    ensureRemoteAvatarCached,
    ensureStorageDirectories,
    getDesktopPreferences,
    getStorageInfo,
    listStickerEntries,
    logout,
    moveStickerEntry,
    markAppQuitting,
    pathApi,
    publishUpdateState,
    readStateCache,
    registerWindowContext,
    renameStickerEntry,
    resolveWindowByEvent,
    saveDownloadedAsset,
    screenshotSelection,
    setUnreadCount,
    shell,
    showDesktopNotification,
    slideOutListWindow,
    targetOrigin,
    toggleWindowMaximize,
    trayRef,
    updateDesktopPreferences,
    updateStateRef,
    walkStickerFiles,
    windowStateBuilder,
    writeImageToClipboard,
    writeStateCache,
  } = deps;

  ipcMain.handle("desktop:get-window-state", (event) => windowStateBuilder(resolveWindowByEvent(event)));
  ipcMain.handle("desktop:get-runtime-config", () => ({
    serverOrigin: targetOrigin,
  }));
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
      return publishUpdateState({
        status: "unavailable",
        available: false,
        error: "开发模式不执行自动更新",
      });
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
  ipcMain.handle("desktop:update-window-context", (event, payload = {}) => {
    const currentWindow = resolveWindowByEvent(event);
    registerWindowContext(currentWindow, payload || {});
    return true;
  });
  ipcMain.handle("desktop:resolve-avatar-source", async (_event, sourceUrl) => {
    try {
      return await ensureRemoteAvatarCached(sourceUrl);
    } catch {
      return String(sourceUrl || "");
    }
  });
  ipcMain.handle("desktop:save-downloaded-file", async (_event, payload = {}) => saveDownloadedAsset({
    fileName: payload.fileName,
    bytes: payload.bytes,
    conversationId: payload.conversationId,
    cacheKey: payload.cacheKey,
    saveAs: Boolean(payload.saveAs),
  }));
  ipcMain.handle("desktop:capture-screenshot", async () => screenshotSelection.captureRegionScreenshot());
  ipcMain.handle("desktop:complete-screenshot-selection", (_event, payload = {}) => screenshotSelection.completeScreenshotSelection(payload));
  ipcMain.handle("desktop:cancel-screenshot-selection", () => screenshotSelection.cancelScreenshotSelection());
  ipcMain.handle("desktop:write-image-to-clipboard", (_event, payload = {}) => writeImageToClipboard(payload));
  ipcMain.handle("desktop:read-state-cache", (_event, payload = {}) => readStateCache(payload.scope, payload.key));
  ipcMain.handle("desktop:write-state-cache", (_event, payload = {}) => writeStateCache(payload.scope, payload.key, payload.data));
  ipcMain.handle("desktop:open-storage-path", async (_event, targetPath) => {
    const nextPath = String(targetPath || "").trim();
    if (!nextPath || !fs.existsSync(nextPath)) return false;
    const stat = fs.statSync(nextPath);
    if (stat.isFile()) {
      shell.showItemInFolder(nextPath);
      return true;
    }
    await shell.openPath(nextPath);
    return true;
  });
  ipcMain.handle("desktop:open-file", async (_event, targetPath) => {
    const nextPath = String(targetPath || "").trim();
    if (!nextPath || !fs.existsSync(nextPath)) return false;
    const stat = fs.statSync(nextPath);
    if (!stat.isFile()) return false;
    const result = await shell.openPath(nextPath);
    return !result;
  });
  ipcMain.handle("desktop:clear-cache", () => {
    const summary = clearDesktopCaches(getStorageInfo());
    ensureStorageDirectories();
    return {
      summary,
      storage: getStorageInfo(),
    };
  });
  ipcMain.handle("desktop:choose-directory", async (_event, options = {}) => {
    const result = await dialog.showOpenDialog({
      title: options?.title || "选择目录",
      defaultPath: String(options?.defaultPath || "").trim() || getStorageInfo().exports,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths?.[0]) return "";
    return result.filePaths[0];
  });
  ipcMain.handle("desktop:list-stickers", () => listStickerEntries(ensureStorageDirectories().stickers));
  ipcMain.handle("desktop:import-sticker-files", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入表情图片",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: Array.from(STICKER_EXTENSIONS).map((item) => item.replace(/^\./, "")) }],
    });
    const stickersDir = ensureStorageDirectories().stickers;
    if (result.canceled || !result.filePaths?.length) return listStickerEntries(stickersDir);
    result.filePaths.forEach((filePath) => copyStickerIntoLibrary(stickersDir, filePath));
    return listStickerEntries(stickersDir);
  });
  ipcMain.handle("desktop:import-sticker-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入表情文件夹",
      properties: ["openDirectory"],
    });
    const stickersDir = ensureStorageDirectories().stickers;
    if (result.canceled || !result.filePaths?.[0]) return listStickerEntries(stickersDir);
    const folderPath = result.filePaths[0];
    const files = walkStickerFiles(folderPath).slice(0, 200);
    const prefix = pathApi.basename(folderPath);
    files.forEach((filePath) => copyStickerIntoLibrary(stickersDir, filePath, prefix));
    return listStickerEntries(stickersDir);
  });
  ipcMain.handle("desktop:rename-sticker", (_event, payload = {}) => renameStickerEntry(ensureStorageDirectories().stickers, payload.id, payload.name));
  ipcMain.handle("desktop:delete-sticker", (_event, stickerId) => deleteStickerEntry(ensureStorageDirectories().stickers, stickerId));
  ipcMain.handle("desktop:move-sticker", (_event, payload = {}) => moveStickerEntry(ensureStorageDirectories().stickers, payload.id, payload.direction));
  ipcMain.handle("desktop:minimize", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    window.minimize();
    return windowStateBuilder(window);
  });
  ipcMain.handle("desktop:toggle-maximize", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    toggleWindowMaximize(window);
    return windowStateBuilder(window);
  });
  ipcMain.handle("desktop:close", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    window.close();
    return null;
  });
  ipcMain.handle("desktop:login-success", (event) => {
    createListWindow();
    const window = resolveWindowByEvent(event);
    if (window && !window.isDestroyed()) {
      window.close();
    }
    return true;
  });
  ipcMain.handle("desktop:open-chat-window", (_event, conversationId) => {
    createChatWindow(conversationId);
    slideOutListWindow();
    return true;
  });
  ipcMain.handle("desktop:logout", () => {
    logout();
    return true;
  });
  ipcMain.handle("desktop:show-notification", (_event, payload) => showDesktopNotification(payload || {}));
  ipcMain.handle("desktop:beep", () => {
    shell.beep();
    return true;
  });
  ipcMain.handle("desktop:update-unread-count", (_event, nextCount) => {
    const unreadCount = setUnreadCount(nextCount);
    const tray = trayRef();
    if (tray && !tray.isDestroyed?.()) {
      tray.setToolTip(buildTrayTooltip(unreadCount));
      tray.setContextMenu(buildTrayMenu());
    }
    return unreadCount;
  });
}

module.exports = {
  registerDesktopIpcHandlers,
};
