const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const { writeImageToClipboard } = require("./desktop-media.cjs");
const { createDesktopAppController } = require("./desktop-app-controller.cjs");
const { bootstrapDesktopMain } = require("./desktop-main-bootstrap.cjs");
const { createDesktopMainContext } = require("./desktop-main-context.cjs");
const { clearDesktopCaches } = require("./cache-maintenance.cjs");
const { registerDesktopIpcHandlers } = require("./desktop-ipc.cjs");
const { createDesktopUpdateController } = require("./desktop-updates.cjs");
const { buildWindowState, clearWindowContext, createDesktopWindowController, focusWindow, resolveWindowByEvent, setWindowContext, shouldSuppressDesktopNotification, toggleWindowMaximize } = require("./desktop-windows.cjs");
const { broadcastOpenConversation, buildTrayMenu, buildTrayTooltip, createTrayIcon, destroyTray, ensureTray, hideAllChatWindows, logoutToLoginFromTray, resolveTrayIconPath, showDesktopNotification, showPrimaryWindowFromTray } = require("./desktop-tray.cjs");
const { createScreenshotSelectionManager } = require("./screenshot-selection.cjs");
const { ensureRemoteAvatarCached, ensureStorageDirectories, getDefaultDesktopPreferences, getDesktopPreferences, getStorageInfo, readStateCache, saveDownloadedAsset, writeDesktopPreferences, writeStateCache } = require("./desktop-storage.cjs");
const { STICKER_EXTENSIONS, listStickerEntries, copyStickerIntoLibrary, walkStickerFiles, renameStickerEntry, deleteStickerEntry, moveStickerEntry } = require("./sticker-library.cjs");

const context = createDesktopMainContext({
  __dirname,
  buildWindowState,
  createScreenshotSelectionManager,
  processEnv: process.env,
  processExecPath: process.execPath,
  processResourcesPath: process.resourcesPath,
});

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.setFeedURL({ provider: "generic", url: context.updateFeedUrl });

const { desktopApp } = bootstrapDesktopMain({
  BrowserWindow,
  Menu,
  Notification,
  Tray,
  app,
  autoUpdater,
  buildTrayMenu,
  buildTrayTooltip,
  clearDesktopCaches,
  context,
  copyStickerIntoLibrary,
  createDesktopAppController,
  createDesktopUpdateController,
  createDesktopWindowController,
  deleteStickerEntry,
  destroyTray,
  dialog,
  ensureRemoteAvatarCached,
  ensureStorageDirectories,
  ensureTray,
  focusWindow,
  fs,
  getDefaultDesktopPreferences,
  getDesktopPreferences,
  getStorageInfo,
  hideAllChatWindows,
  listStickerEntries,
  logoutToLoginFromTray,
  stickerDeps: { STICKER_EXTENSIONS },
  moveStickerEntry,
  nativeImage,
  path,
  readStateCache,
  registerDesktopIpcHandlers,
  renameStickerEntry,
  resolveTrayIconPath,
  resolveWindowByEvent,
  saveDownloadedAsset,
  setWindowContext,
  shouldSuppressDesktopNotification,
  shell,
  showDesktopNotification,
  trayDeps: { broadcastOpenConversation, createTrayIcon, showPrimaryWindowFromTray },
  toggleWindowMaximize,
  walkStickerFiles,
  windowHelpers: { buildWindowState, clearWindowContext },
  writeDesktopPreferences,
  writeImageToClipboard,
  writeStateCache,
});

app.on("before-quit", desktopApp.handleBeforeQuit);
app.on("will-quit", desktopApp.handleWillQuit);

app.whenReady().then(() => {
  desktopApp.handleReady();
  app.on("activate", () => {
    desktopApp.openPrimaryFromTray();
  });
}).catch((error) => {
  console.error("[desktop] startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});
