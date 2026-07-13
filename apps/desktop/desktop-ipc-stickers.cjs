function registerDesktopStickerIpc(ipcMain, deps) {
  const {
    STICKER_EXTENSIONS,
    copyStickerIntoLibrary,
    deleteStickerEntry,
    dialog,
    ensureStorageDirectories,
    listStickerEntries,
    moveStickerEntry,
    pathApi,
    renameStickerEntry,
    walkStickerFiles,
  } = deps;

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
    const result = await dialog.showOpenDialog({ title: "导入表情文件夹", properties: ["openDirectory"] });
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
}

module.exports = {
  registerDesktopStickerIpc,
};
