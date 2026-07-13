const { ipcMain } = require("electron");
const { registerDesktopInfoIpc } = require("./desktop-ipc-info.cjs");
const { registerDesktopMediaIpc } = require("./desktop-ipc-media.cjs");
const { registerDesktopStickerIpc } = require("./desktop-ipc-stickers.cjs");
const { registerDesktopWindowActionIpc } = require("./desktop-ipc-window-actions.cjs");

function registerDesktopIpcHandlers(deps) {
  registerDesktopInfoIpc(ipcMain, deps);
  registerDesktopMediaIpc(ipcMain, deps);
  registerDesktopStickerIpc(ipcMain, deps);
  registerDesktopWindowActionIpc(ipcMain, deps);
}

module.exports = {
  registerDesktopIpcHandlers,
};
