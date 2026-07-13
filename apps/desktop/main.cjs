const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const { writeImageToClipboard } = require("./desktop-media.cjs");
const { clearDesktopCaches } = require("./cache-maintenance.cjs");
const { registerDesktopIpcHandlers } = require("./desktop-ipc.cjs");
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

const DEFAULT_REMOTE_ORIGIN = "http://186.241.89.102";
const projectRoot = path.resolve(__dirname, "../..");
const port = process.env.DESKTOP_PORT || process.env.PORT || "3010";
const preloadPath = path.join(__dirname, "preload.cjs");
const screenshotSelectionPreloadPath = path.join(__dirname, "screenshot-selection-preload.cjs");
const rendererRoot = path.join(projectRoot, "apps", "web", "dist");
const loginPagePath = path.join(rendererRoot, "login.html");
const listPagePath = path.join(rendererRoot, "list.html");
const chatPagePath = path.join(rendererRoot, "chat.html");
const configCandidates = [
  path.join(projectRoot, "desktop-config.json"),
  path.join(process.resourcesPath || "", "desktop-config.json"),
  path.join(path.dirname(process.execPath), "desktop-config.json"),
];

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function readDesktopConfigValue(key) {
  for (const file of configCandidates) {
    try {
      if (!file || !fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const value = normalizeOrigin(parsed?.[key]);
      if (value) return value;
    } catch (error) {
      console.error(`[desktop] failed to read config ${file}`, error);
    }
  }
  return "";
}

function readRemoteOrigin() {
  const envOrigin = normalizeOrigin(process.env.DESKTOP_REMOTE_ORIGIN);
  if (envOrigin) return envOrigin;

  return readDesktopConfigValue("remoteOrigin") || DEFAULT_REMOTE_ORIGIN;
}

const remoteOrigin = readRemoteOrigin();
const localOrigin = `http://127.0.0.1:${port}`;
const targetOrigin = remoteOrigin || localOrigin;
const updateFeedUrl = normalizeOrigin(process.env.DESKTOP_UPDATE_FEED_URL)
  || readDesktopConfigValue("updateFeedUrl")
  || `${remoteOrigin}/updates/desktop/win/stable`;

let loginWindow = null;
let listWindow = null;
const chatWindows = new Map();
const windowContextById = new Map();
let tray = null;
let isQuitting = false;
let listWindowBoundsSnapshot = null;
let listWindowAnimating = false;
let unreadCount = 0;
let updateState = {
  status: "idle",
  available: false,
  downloaded: false,
  progress: 0,
  version: "",
  error: "",
};
const screenshotSelection = createScreenshotSelectionManager({
  preloadPath: screenshotSelectionPreloadPath,
});

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });

function setUnreadCount(nextCount) {
  unreadCount = Math.max(0, Number(nextCount || 0));
  return unreadCount;
}

function markAppQuitting() {
  isQuitting = true;
}

function applyLaunchOnStartupPreference() {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  app.setLoginItemSettings({ openAtLogin: Boolean(getDesktopPreferences().launchOnStartup) });
}

function publishDesktopPreferences() {
  const payload = { preferences: getDesktopPreferences(), storage: getStorageInfo() };
  getLiveWindows().forEach((window) => window.webContents.send("desktop:preferences-changed", payload));
  return payload;
}

function updateDesktopPreferences(patch = {}) {
  const current = getDesktopPreferences();
  const next = { ...current, ...patch };
  if (!String(next.downloadsDir || "").trim()) {
    next.downloadsDir = getDefaultDesktopPreferences().downloadsDir;
  }
  writeDesktopPreferences(next);
  ensureStorageDirectories();
  applyLaunchOnStartupPreference();
  if (tray && !tray.isDestroyed?.()) {
    tray.setToolTip(buildTrayTooltip(unreadCount));
    tray.setContextMenu(buildTrayMenu({
      Menu,
      getDesktopPreferences,
      updateDesktopPreferences,
      showPrimaryWindowFromTray: () => showPrimaryWindowFromTray({
        listWindow,
        loginWindow,
        restoreListWindowPosition,
        focusWindow,
        createLoginWindow,
      }),
      logoutToLoginFromTray: () => logoutToLoginFromTray({
        getLiveWindows,
        listWindow: () => listWindow,
        closeAllChatWindows,
        createLoginWindow,
      }),
      quitDesktopApp,
    }));
  }
  return publishDesktopPreferences();
}

function publishUpdateState(patch = {}) {
  updateState = { ...updateState, ...patch };
  getLiveWindows().forEach((window) => {
    window.webContents.send("desktop:update-state", updateState);
  });
  return updateState;
}

function registerAutoUpdaterEvents() {
  autoUpdater.on("checking-for-update", () => {
    publishUpdateState({ status: "checking", error: "" });
  });
  autoUpdater.on("update-available", (info) => {
    publishUpdateState({
      status: "available",
      available: true,
      downloaded: false,
      progress: 0,
      version: info?.version || "",
      error: "",
    });
  });
  autoUpdater.on("update-not-available", () => {
    publishUpdateState({
      status: "none",
      available: false,
      downloaded: false,
      progress: 0,
      version: "",
      error: "",
    });
  });
  autoUpdater.on("download-progress", (progress) => {
    publishUpdateState({
      status: "downloading",
      available: true,
      progress: Math.max(0, Math.min(100, Math.round(progress?.percent || 0))),
      error: "",
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    publishUpdateState({
      status: "downloaded",
      available: true,
      downloaded: true,
      progress: 100,
      version: info?.version || updateState.version || "",
      error: "",
    });
  });
  autoUpdater.on("error", (error) => {
    publishUpdateState({
      status: "error",
      error: error?.message || "更新失败",
    });
  });
}

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

function quitDesktopApp() {
  if (isQuitting) return;
  isQuitting = true;
  tray = destroyTray(tray);
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
  app.quit();
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
  isQuittingRef: () => isQuitting,
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

function logout() {
  if (listWindow && !listWindow.isDestroyed()) {
    listWindow.destroy();
    listWindow = null;
  }
  closeAllChatWindows();
  createLoginWindow();
}

function openPrimaryFromTray() {
  showPrimaryWindowFromTray({
    listWindow,
    loginWindow,
    restoreListWindowPosition,
    focusWindow,
    createLoginWindow,
  });
}

function buildTrayMenuForApp() {
  return buildTrayMenu({
    Menu,
    getDesktopPreferences,
    updateDesktopPreferences,
    showPrimaryWindowFromTray: openPrimaryFromTray,
    logoutToLoginFromTray: () => logoutToLoginFromTray({
      getLiveWindows,
      listWindow: () => listWindow,
      closeAllChatWindows,
      createLoginWindow,
    }),
    quitDesktopApp,
  });
}

registerDesktopIpcHandlers({
  STICKER_EXTENSIONS,
  app,
  autoUpdater,
  buildTrayMenu: buildTrayMenuForApp,
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
  pathApi: path,
  publishUpdateState,
  readStateCache,
  registerWindowContext: setWindowContext,
  renameStickerEntry,
  resolveWindowByEvent,
  saveDownloadedAsset,
  screenshotSelection,
  setUnreadCount,
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
    showPrimaryWindowFromTray: openPrimaryFromTray,
  }),
  slideOutListWindow,
  targetOrigin,
  toggleWindowMaximize,
  trayRef: () => tray,
  updateDesktopPreferences,
  updateStateRef: () => updateState,
  walkStickerFiles,
  windowStateBuilder: buildWindowState,
  writeImageToClipboard,
  writeStateCache,
});
registerAutoUpdaterEvents();

app.on("before-quit", () => {
  isQuitting = true;
  tray = destroyTray(tray);
});

app.on("will-quit", () => {
  chatWindows.clear();
  listWindow = null;
  loginWindow = null;
});

app.whenReady().then(async () => {
  getDesktopPreferences();
  applyLaunchOnStartupPreference();
  ensureStorageDirectories();
  tray = ensureTray({
    existingTray: tray,
    Tray,
    createTrayIcon: () => createTrayIcon({
      nativeImage,
      resolveTrayIconPath: () => resolveTrayIconPath({ fs, path, process, projectRoot }),
    }),
    buildTrayTooltip,
    unreadCount,
    buildTrayMenu: buildTrayMenuForApp,
    showPrimaryWindowFromTray: openPrimaryFromTray,
  });
  createLoginWindow();
  app.on("activate", async () => {
    openPrimaryFromTray();
  });
}).catch((error) => {
  console.error("[desktop] startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});
