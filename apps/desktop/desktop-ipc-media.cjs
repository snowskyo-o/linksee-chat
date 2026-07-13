const fs = require("node:fs");

function registerDesktopMediaIpc(ipcMain, deps) {
  const {
    clearDesktopCaches,
    dialog,
    ensureRemoteAvatarCached,
    ensureStorageDirectories,
    getStorageInfo,
    pathApi,
    readStateCache,
    saveDownloadedAsset,
    screenshotSelection,
    shell,
    walkStickerFiles,
    writeImageToClipboard,
    writeStateCache,
  } = deps;

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
    if (stat.isFile()) return void shell.showItemInFolder(nextPath) || true;
    await shell.openPath(nextPath);
    return true;
  });
  ipcMain.handle("desktop:open-file", async (_event, targetPath) => {
    const nextPath = String(targetPath || "").trim();
    if (!nextPath || !fs.existsSync(nextPath)) return false;
    if (!fs.statSync(nextPath).isFile()) return false;
    const result = await shell.openPath(nextPath);
    return !result;
  });
  ipcMain.handle("desktop:clear-cache", () => {
    const summary = clearDesktopCaches(getStorageInfo());
    ensureStorageDirectories();
    return { summary, storage: getStorageInfo() };
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

  return {
    walkStickerFiles,
    pathApi,
  };
}

module.exports = {
  registerDesktopMediaIpc,
};
