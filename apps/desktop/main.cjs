const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const { writeImageToClipboard } = require("./desktop-media.cjs");
const { createDesktopAppController } = require("./desktop-app-controller.cjs");
const { clearDesktopCaches } = require("./cache-maintenance.cjs");
const { buildDesktopRuntimeConfig } = require("./desktop-config.cjs");
const { registerDesktopIpcHandlers } = require("./desktop-ipc.cjs");
const { createDesktopUpdateController } = require("./desktop-updates.cjs");
const {
  buildWindowState,
  clearWindowContext,
  createDesktopWindowController,
  focusWindow,
  resolveWindowByEvent,
  setWindowContext,
  shouldSuppressDesktopNotification,
  toggleWindowMaximize,
} = require("./desktop-windows.cjs");
const {
  broadcastOpenConversation,
  buildTrayMenu,
  buildTrayTooltip,
  createTrayIcon,
  destroyTray,
  ensureTray,
  hideAllChatWindows,
  logoutToLoginFromTray,
  resolveTrayIconPath,
  showDesktopNotification,
  showPrimaryWindowFromTray,
} = require("./desktop-tray.cjs");
const { createScreenshotSelectionManager } = require("./screenshot-selection.cjs");
const {
  ensureRemoteAvatarCached,
  ensureStorageDirectories,
  getDefaultDesktopPreferences,
  getDesktopPreferences,
  getStorageInfo,
  readStateCache,
  saveDownloadedAsset,
  writeDesktopPreferences,
  writeStateCache,
} = require("./desktop-storage.cjs");
const { STICKER_EXTENSIONS, listStickerEntries, copyStickerIntoLibrary, walkStickerFiles, renameStickerEntry, deleteStickerEntry, moveStickerEntry } = require("./sticker-library.cjs");

const projectRoot = path.resolve(__dirname, "../..");
const port = process.env.DESKTOP_PORT || process.env.PORT || "3010";
const preloadPath = path.join(__dirname, "preload.cjs");
const screenshotSelectionPreloadPath = path.join(__dirname, "screenshot-selection-preload.cjs");
const rendererRoot = path.join(projectRoot, "apps", "web", "dist");
const loginPagePath = path.join(rendererRoot, "login.html");
const listPagePath = path.join(rendererRoot, "list.html");
const chatPagePath = path.join(rendererRoot, "chat.html");
const { targetOrigin, updateFeedUrl } = buildDesktopRuntimeConfig({
  projectRoot,
  processEnv: process.env,
  processResourcesPath: process.resourcesPath,
  processExecPath: process.execPath,
  port,
});

let loginWindow = null;
let listWindow = null;
const chatWindows = new Map();
const windowContextById = new Map();
let tray = null;
let listWindowBoundsSnapshot = null;
let listWindowAnimating = false;
const screenshotSelection = createScreenshotSelectionManager({
  preloadPath: screenshotSelectionPreloadPath,
});
const desktopAppState = {
  unreadCount: 0,
  isQuitting: false,
  getLoginWindow: () => loginWindow,
  setListWindow: (value) => {
    listWindow = value;
  },
  getListWindow: () => listWindow,
  getTray: () => tray,
  clearWindows: () => {
    chatWindows.clear();
    listWindow = null;
    loginWindow = null;
  },
};

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });

function sendWindowState(window) {
  if (!window || window.isDestroyed()) return;
  window.webContents.send("desktop:window-state", buildWindowState(window));
}

function buildArguments({ kind, conversationId = "" }) {
  return [
    `--remote-origin=${targetOrigin}`,
    `--window-kind=${kind}`,
    `--conversation-id=${conversationId}`,
  ];
}

function hideWindowToTray(window) {
  if (!window || window.isDestroyed()) return;
  window.hide();
}

function quitWindows() {
  for (const window of chatWindows.values()) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }
  if (listWindow && !listWindow.isDestroyed()) {
    listWindow.close();
  }
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.close();
  }
}

const desktopWindowState = {
  chatWindows,
  get listWindow() {
    return listWindow;
  },
  set listWindow(value) {
    listWindow = value;
  },
  get listWindowBoundsSnapshot() {
    return listWindowBoundsSnapshot;
  },
  set listWindowBoundsSnapshot(value) {
    listWindowBoundsSnapshot = value;
  },
  get loginWindow() {
    return loginWindow;
  },
  set loginWindow(value) {
    loginWindow = value;
  },
  get listWindowAnimating() {
    return listWindowAnimating;
  },
  set listWindowAnimating(value) {
    listWindowAnimating = value;
  },
};

const desktopWindows = createDesktopWindowController({
  BrowserWindow,
  buildArguments,
  buildWindowState,
  chatPagePath,
  clearWindowContext: (window) => clearWindowContext(windowContextById, window),
  createLoginWindowRef: {
    quitDesktopApp,
  },
  getDesktopPreferences,
  hideAllChatWindows,
  hideWindowToTray,
  isQuittingRef: () => desktopAppState.isQuitting,
  listPagePath,
  loginPagePath,
  preloadPath,
  sendWindowState,
  setWindowContext: (window, context) => setWindowContext(windowContextById, window, context),
  state: desktopWindowState,
});

const {
  createChatWindow,
  createListWindow,
  createLoginWindow,
  closeAllChatWindows,
  getLiveWindows,
  restoreListWindowPosition,
  slideOutListWindow,
} = desktopWindows;
const desktopUpdates = createDesktopUpdateController({
  autoUpdater,
  getLiveWindows,
});
const desktopApp = createDesktopAppController({
  app,
  Menu,
  Tray,
  buildTrayMenu,
  buildTrayTooltip,
  closeAllChatWindows,
  createLoginWindow,
  createTrayIcon: () => createTrayIcon({
    nativeImage,
    resolveTrayIconPath: () => resolveTrayIconPath({ path, process, projectRoot }),
  }),
  destroyTray,
  ensureStorageDirectories,
  ensureTray,
  focusWindow,
  getDefaultDesktopPreferences,
  getDesktopPreferences,
  getLiveWindows,
  getStorageInfo,
  logoutToLoginFromTray,
  quitWindows,
  restoreListWindowPosition,
  setTray: (value) => {
    tray = value;
  },
  showPrimaryWindowFromTray,
  state: {
    ...desktopAppState,
    getLoginWindow: () => loginWindow,
    getListWindow: () => listWindow,
    getTray: () => tray,
  },
  updateTrayMenu: (tooltip, buildMenu) => {
    if (tray && !tray.isDestroyed?.()) {
      tray.setToolTip(tooltip);
      tray.setContextMenu(buildMenu());
    }
  },
  writeDesktopPreferences,
});

registerDesktopIpcHandlers({
  STICKER_EXTENSIONS,
  app,
  autoUpdater,
  buildTrayMenu: desktopApp.buildTrayMenuForApp,
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
  logout: desktopApp.logout,
  moveStickerEntry,
  markAppQuitting: desktopApp.markAppQuitting,
  pathApi: path,
  publishUpdateState: desktopUpdates.publishUpdateState,
  readStateCache,
  registerWindowContext: setWindowContext,
  renameStickerEntry,
  resolveWindowByEvent,
  saveDownloadedAsset,
  screenshotSelection,
  setUnreadCount: desktopApp.setUnreadCount,
  shell,
  showDesktopNotification: (payload) => showDesktopNotification({
    Notification,
    ...payload,
    getDesktopPreferences,
    resolveTrayIconPath: () => resolveTrayIconPath({ fs, path, process, projectRoot }),
    shouldSuppressDesktopNotification: (conversationId) => shouldSuppressDesktopNotification(BrowserWindow, windowContextById, conversationId),
    createListWindow,
    createChatWindow,
    broadcastOpenConversation: (conversationId) => broadcastOpenConversation(conversationId, { listWindow, chatWindows }),
    slideOutListWindow,
    focusWindow,
    listWindow: () => listWindow,
    showPrimaryWindowFromTray: desktopApp.openPrimaryFromTray,
  }),
  slideOutListWindow,
  targetOrigin,
  toggleWindowMaximize,
  trayRef: () => tray,
  updateDesktopPreferences: desktopApp.updateDesktopPreferences,
  updateStateRef: desktopUpdates.updateStateRef,
  walkStickerFiles,
  windowStateBuilder: buildWindowState,
  writeImageToClipboard,
  writeStateCache,
});
desktopUpdates.registerAutoUpdaterEvents();

app.on("before-quit", desktopApp.handleBeforeQuit);

app.on("will-quit", desktopApp.handleWillQuit);

app.whenReady().then(async () => {
  desktopApp.handleReady();
  app.on("activate", async () => {
    desktopApp.openPrimaryFromTray();
  });
}).catch((error) => {
  console.error("[desktop] startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});
