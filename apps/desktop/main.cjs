const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");
const { writeImageToClipboard } = require("./desktop-media.cjs");
const { clearDesktopCaches } = require("./cache-maintenance.cjs");
const { registerDesktopIpcHandlers } = require("./desktop-ipc.cjs");
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

function resolveWindowByEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function buildWindowState(window) {
  return !window || window.isDestroyed() ? { isMaximized: false } : { isMaximized: window.isMaximized() };
}

function toggleWindowMaximize(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }
}

function getLiveWindows() {
  return [loginWindow, listWindow, ...chatWindows.values()].filter((window) => window && !window.isDestroyed());
}

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

function createShellWindow({
  width,
  height,
  minWidth,
  minHeight,
  transparent = false,
  resizable = true,
  maximizable = true,
  fullscreenable = true,
  title = "Linksee Chat",
  backgroundColor = "#f4f7fb",
  pagePath,
  pageQuery = {},
  kind,
  conversationId = "",
}) {
  const window = new BrowserWindow({
    width,
    height,
    minWidth,
    minHeight,
    transparent,
    hasShadow: true,
    resizable,
    maximizable,
    fullscreenable,
    autoHideMenuBar: true,
    frame: false,
    title,
    backgroundColor,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: process.platform === "darwin" ? { x: 16, y: 16 } : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: buildArguments({ kind, conversationId }),
    },
  });

  window.on("maximize", () => sendWindowState(window));
  window.on("unmaximize", () => sendWindowState(window));
  window.on("enter-full-screen", () => sendWindowState(window));
  window.on("leave-full-screen", () => sendWindowState(window));
  window.once("ready-to-show", () => sendWindowState(window));
  window.loadFile(pagePath, { query: pageQuery }).catch((error) => {
    console.error("[desktop] failed to load renderer", error);
  });

  return window;
}

function focusWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function snapshotWindowBounds(window) {
  if (!window || window.isDestroyed()) return null;
  const bounds = window.getBounds();
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function animateWindowBounds(window, fromBounds, toBounds, { duration = 180, onDone } = {}) {
  if (!window || window.isDestroyed()) {
    if (typeof onDone === "function") onDone();
    return;
  }

  const start = Date.now();
  const tick = () => {
    if (!window || window.isDestroyed()) {
      if (typeof onDone === "function") onDone();
      return;
    }

    const elapsed = Date.now() - start;
    const progress = Math.min(1, elapsed / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const nextBounds = {
      x: Math.round(fromBounds.x + ((toBounds.x - fromBounds.x) * eased)),
      y: Math.round(fromBounds.y + ((toBounds.y - fromBounds.y) * eased)),
      width: Math.round(fromBounds.width + ((toBounds.width - fromBounds.width) * eased)),
      height: Math.round(fromBounds.height + ((toBounds.height - fromBounds.height) * eased)),
    };

    window.setBounds(nextBounds, false);
    if (progress >= 1) {
      if (typeof onDone === "function") onDone();
      return;
    }
    setTimeout(tick, 12);
  };

  tick();
}

function slideOutListWindow() {
  if (!listWindow || listWindow.isDestroyed() || listWindowAnimating) return;
  if (!listWindow.isVisible()) return;

  listWindowAnimating = true;
  listWindowBoundsSnapshot = snapshotWindowBounds(listWindow) || listWindowBoundsSnapshot;
  const fromBounds = snapshotWindowBounds(listWindow);
  if (!fromBounds) {
    listWindowAnimating = false;
    return;
  }

  const toBounds = {
    ...fromBounds,
    x: fromBounds.x + Math.round(fromBounds.width * 0.72),
  };

  animateWindowBounds(listWindow, fromBounds, toBounds, {
    duration: 180,
    onDone: () => {
      if (listWindow && !listWindow.isDestroyed()) {
        listWindow.hide();
        if (listWindowBoundsSnapshot) {
          listWindow.setBounds(listWindowBoundsSnapshot, false);
        }
      }
      listWindowAnimating = false;
    },
  });
}

function restoreListWindowPosition() {
  if (!listWindow || listWindow.isDestroyed()) return;
  if (!listWindowBoundsSnapshot) {
    listWindowBoundsSnapshot = snapshotWindowBounds(listWindow);
    return;
  }
  listWindow.setBounds(listWindowBoundsSnapshot, false);
}

function hideWindowToTray(window) {
  if (!window || window.isDestroyed()) return;
  window.hide();
}

function setWindowContext(window, context = {}) {
  if (!window || window.isDestroyed()) return;
  const existing = windowContextById.get(window.id) || {};
  windowContextById.set(window.id, {
    ...existing,
    kind: String(context.kind || existing.kind || "").trim(),
    conversationId: String(context.conversationId || existing.conversationId || "").trim(),
  });
}

function clearWindowContext(window) {
  if (!window) return;
  windowContextById.delete(window.id);
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

function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    focusWindow(loginWindow);
    return loginWindow;
  }
  loginWindow = createShellWindow({
    width: 420,
    height: 560,
    minWidth: 420,
    minHeight: 560,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Linksee Chat Login",
    backgroundColor: "#00000000",
    pagePath: loginPagePath,
    kind: "login",
  });
  setWindowContext(loginWindow, { kind: "login", conversationId: "" });

  loginWindow.on("close", (event) => {
    if (isQuitting) return;
    if (!getDesktopPreferences().closeToTray) {
      quitDesktopApp();
      return;
    }
    event.preventDefault();
    hideWindowToTray(loginWindow);
  });

  loginWindow.on("closed", () => {
    clearWindowContext(loginWindow);
    loginWindow = null;
  });

  return loginWindow;
}

function createListWindow() {
  if (listWindow && !listWindow.isDestroyed()) {
    focusWindow(listWindow);
    return listWindow;
  }
  listWindow = createShellWindow({
    width: 344,
    height: 760,
    minWidth: 328,
    minHeight: 680,
    maximizable: false,
    title: "Linksee Chat",
    backgroundColor: "#eef3f9",
    pagePath: listPagePath,
    kind: "list",
  });
  setWindowContext(listWindow, { kind: "list", conversationId: "" });

  listWindow.on("close", (event) => {
    if (isQuitting) return;
    if (!getDesktopPreferences().closeToTray) {
      quitDesktopApp();
      return;
    }
    event.preventDefault();
    hideWindowToTray(listWindow);
    hideAllChatWindows(chatWindows);
  });

  listWindow.on("move", () => {
    if (listWindowAnimating || !listWindow || listWindow.isDestroyed() || !listWindow.isVisible()) return;
    listWindowBoundsSnapshot = snapshotWindowBounds(listWindow);
  });

  listWindow.on("closed", () => {
    clearWindowContext(listWindow);
    listWindow = null;
  });

  return listWindow;
}

function createChatWindow(conversationId) {
  const key = String(conversationId || "").trim();
  if (!key) return null;
  const existing = chatWindows.get(key);
  if (existing && !existing.isDestroyed()) {
    focusWindow(existing);
    return existing;
  }
  const chatWindow = createShellWindow({
    width: 1100,
    height: 820,
    minWidth: 820,
    minHeight: 620,
    title: "Linksee Chat Conversation",
    backgroundColor: "#f3f6fb",
    pagePath: chatPagePath,
    pageQuery: { conversationId: key, mode: "conversation" },
    kind: "chat",
    conversationId: key,
  });
  setWindowContext(chatWindow, { kind: "chat", conversationId: key });

  chatWindow.on("closed", () => {
    clearWindowContext(chatWindow);
    chatWindows.delete(key);
  });
  chatWindows.set(key, chatWindow);
  return chatWindow;
}

function closeAllChatWindows() {
  for (const window of chatWindows.values()) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }
  chatWindows.clear();
}

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
    shouldSuppressDesktopNotification: (conversationId) => {
      const targetConversationId = String(conversationId || "").trim();
      if (!targetConversationId) return false;
      for (const [windowId, context] of windowContextById.entries()) {
        const currentWindow = BrowserWindow.fromId(windowId);
        if (!currentWindow || currentWindow.isDestroyed() || currentWindow.isMinimized() || !currentWindow.isVisible()) continue;
        if (!currentWindow.isFocused()) continue;
        if (String(context?.conversationId || "").trim() === targetConversationId) return true;
      }
      return false;
    },
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
