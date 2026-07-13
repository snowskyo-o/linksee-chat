const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEFAULT_REMOTE_ORIGIN = "http://186.241.89.102";
const projectRoot = path.resolve(__dirname, "../..");
const port = process.env.DESKTOP_PORT || process.env.PORT || "3010";
const preloadPath = path.join(__dirname, "preload.cjs");
const rendererRoot = path.join(projectRoot, "apps", "web", "dist");
const loginPagePath = path.join(rendererRoot, "login.html");
const listPagePath = path.join(rendererRoot, "list.html");
const chatPagePath = path.join(rendererRoot, "chat.html");
const configCandidates = [
  path.join(projectRoot, "desktop-config.json"),
  path.join(process.resourcesPath || "", "desktop-config.json"),
  path.join(path.dirname(process.execPath), "desktop-config.json"),
];

function getDefaultDesktopPreferences() {
  return { downloadsDir: path.join(app.getPath("downloads"), "Linksee Chat"), launchOnStartup: false, notificationsMuted: false, closeToTray: true };
}

function getDesktopPreferencesPath() {
  return path.join(app.getPath("userData"), "desktop-preferences.json");
}

function loadDesktopPreferences() {
  const defaults = getDefaultDesktopPreferences();
  try {
    const filePath = getDesktopPreferencesPath();
    if (!fs.existsSync(filePath)) return defaults;
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      downloadsDir: String(parsed?.downloadsDir || defaults.downloadsDir).trim() || defaults.downloadsDir,
      launchOnStartup: Boolean(parsed?.launchOnStartup),
      notificationsMuted: Boolean(parsed?.notificationsMuted),
      closeToTray: parsed?.closeToTray !== false,
    };
  } catch {
    return defaults;
  }
}

let desktopPreferences = null;

function getDesktopPreferences() {
  if (!desktopPreferences) desktopPreferences = loadDesktopPreferences();
  return desktopPreferences;
}

function writeDesktopPreferences(nextPreferences) {
  desktopPreferences = { ...getDefaultDesktopPreferences(), ...(nextPreferences || {}) };
  fs.writeFileSync(getDesktopPreferencesPath(), JSON.stringify(desktopPreferences, null, 2), "utf8");
  return desktopPreferences;
}

function getStorageInfo() {
  const preferences = getDesktopPreferences();
  const root = app.getPath("userData");
  const downloads = String(preferences.downloadsDir || "").trim() || path.join(app.getPath("downloads"), "Linksee Chat");
  return {
    root,
    stickers: path.join(root, "stickers"),
    avatars: path.join(root, "avatars-cache"),
    chatCache: path.join(root, "chat-cache"),
    downloads,
    exports: downloads,
  };
}

function ensureStorageDirectories() {
  const storage = getStorageInfo();
  Object.values(storage).forEach((targetPath) => {
    if (!targetPath) return;
    fs.mkdirSync(targetPath, { recursive: true });
  });
  return storage;
}

const STICKER_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"]);

function isStickerFile(filePath) {
  return STICKER_EXTENSIONS.has(path.extname(String(filePath || "")).toLowerCase());
}

function fileToDataUrl(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeType = extension === ".jpg" || extension === ".jpeg"
    ? "image/jpeg"
    : extension === ".gif"
      ? "image/gif"
      : extension === ".webp"
        ? "image/webp"
        : extension === ".bmp"
          ? "image/bmp"
          : extension === ".svg"
            ? "image/svg+xml"
            : "image/png";
  const payload = fs.readFileSync(filePath).toString("base64");
  return `data:${mimeType};base64,${payload}`;
}

function sanitizeStickerName(value) {
  return String(value || "")
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "sticker";
}

function sanitizeFileName(value, fallback = "file") {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim() || fallback;
}

function hashValue(value) {
  return createHash("sha1").update(String(value || "")).digest("hex");
}

async function ensureRemoteAvatarCached(sourceUrl) {
  const normalized = String(sourceUrl || "").trim();
  if (!/^https?:/i.test(normalized)) return "";
  const { avatars } = ensureStorageDirectories();
  const nextUrl = new URL(normalized);
  const extension = path.extname(nextUrl.pathname || "").toLowerCase() || ".img";
  const filePath = path.join(avatars, `${hashValue(normalized)}${extension}`);
  if (!fs.existsSync(filePath)) {
    const response = await fetch(normalized);
    if (!response.ok) throw new Error(`avatar fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
  }
  return pathToFileURL(filePath).toString();
}

function listStickerEntries() {
  const { stickers } = ensureStorageDirectories();
  if (!fs.existsSync(stickers)) return [];
  return fs.readdirSync(stickers, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isStickerFile(entry.name))
    .map((entry) => {
      const filePath = path.join(stickers, entry.name);
      const stat = fs.statSync(filePath);
      return {
        id: entry.name,
        name: path.parse(entry.name).name,
        fileName: entry.name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        src: fileToDataUrl(filePath),
      };
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

function copyStickerIntoLibrary(sourcePath, prefix = "") {
  if (!sourcePath || !fs.existsSync(sourcePath) || !isStickerFile(sourcePath)) return;
  const { stickers } = ensureStorageDirectories();
  const parsed = path.parse(sourcePath);
  const baseName = sanitizeStickerName(`${prefix ? `${prefix}_` : ""}${parsed.name}`);
  let candidate = `${baseName}${parsed.ext.toLowerCase()}`;
  let nextPath = path.join(stickers, candidate);
  let counter = 1;
  while (fs.existsSync(nextPath)) {
    candidate = `${baseName}_${counter}${parsed.ext.toLowerCase()}`;
    nextPath = path.join(stickers, candidate);
    counter += 1;
  }
  fs.copyFileSync(sourcePath, nextPath);
}

function walkStickerFiles(rootPath, bucket = [], depth = 0) {
  if (!rootPath || !fs.existsSync(rootPath) || depth > 3) return bucket;
  const entries = fs.readdirSync(rootPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const nextPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      walkStickerFiles(nextPath, bucket, depth + 1);
      return;
    }
    if (entry.isFile() && isStickerFile(nextPath)) {
      bucket.push(nextPath);
    }
  });
  return bucket;
}

function ensureConversationCacheDir(conversationId = "shared") {
  const { chatCache } = ensureStorageDirectories();
  const target = path.join(chatCache, sanitizeFileName(conversationId, "shared"));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function ensureStateCacheDir(scope = "shared") {
  const { chatCache } = ensureStorageDirectories();
  const target = path.join(chatCache, "_state", sanitizeFileName(scope, "shared"));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

function readStateCache(scope = "shared", key = "") {
  if (!key) return null;
  const filePath = path.join(ensureStateCacheDir(scope), `${sanitizeFileName(key, "cache")}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeStateCache(scope = "shared", key = "", data = null) {
  if (!key) return false;
  const filePath = path.join(ensureStateCacheDir(scope), `${sanitizeFileName(key, "cache")}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data ?? null, null, 2), "utf8");
  return true;
}

function saveDownloadedAsset({ fileName, bytes, conversationId = "", cacheKey = "" }) {
  const safeName = sanitizeFileName(fileName, "attachment");
  const payload = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const cacheDir = ensureConversationCacheDir(conversationId);
  const { exports } = ensureStorageDirectories();
  const stem = path.parse(safeName).name;
  const extension = path.extname(safeName);
  const uniqueSuffix = `${Date.now()}-${(cacheKey && hashValue(cacheKey).slice(0, 8)) || hashValue(safeName).slice(0, 8)}`;
  const cachePath = path.join(cacheDir, `${stem}-${uniqueSuffix}${extension}`);
  const exportPath = path.join(exports, `${stem}-${uniqueSuffix}${extension}`);
  fs.writeFileSync(cachePath, payload);
  fs.writeFileSync(exportPath, payload);
  return {
    cachePath,
    exportPath,
    cacheUrl: pathToFileURL(cachePath).toString(),
    exportUrl: pathToFileURL(exportPath).toString(),
  };
}

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

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.setFeedURL({ provider: "generic", url: updateFeedUrl });

function createFallbackTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#4f7cff"/>
      <path d="M22 18h8v28h16v8H22V18z" fill="#ffffff"/>
    </svg>
  `.trim();

  return nativeImage
    .createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
    .resize({ width: 16, height: 16 });
}

function resolveTrayIconPath() {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.resourcesPath || "", "icon.ico"),
        path.join(path.dirname(process.execPath), "resources", "icon.ico"),
        path.join(projectRoot, "build", "icon.ico"),
      ]
    : [
        path.join(process.resourcesPath || "", "icon.png"),
        path.join(path.dirname(process.execPath), "resources", "icon.png"),
        path.join(projectRoot, "build", "icon.png"),
      ];

  return candidates.find((file) => file && fs.existsSync(file)) || "";
}

function createTrayIcon() {
  const trayIconPath = resolveTrayIconPath();
  if (trayIconPath) {
    const icon = nativeImage.createFromPath(trayIconPath);
    if (!icon.isEmpty()) {
      return icon.resize({ width: 16, height: 16 });
    }
  }

  return createFallbackTrayIcon();
}

function resolveWindowByEvent(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function buildWindowState(window) {
  if (!window || window.isDestroyed()) {
    return { isMaximized: false };
  }

  return {
    isMaximized: window.isMaximized(),
  };
}

function getLiveWindows() {
  return [loginWindow, listWindow, ...chatWindows.values()].filter((window) => window && !window.isDestroyed());
}

function buildTrayTooltip() {
  const base = "Linksee Chat";
  if (unreadCount <= 0) return base;
  return `${base}（${unreadCount > 99 ? "99+" : unreadCount} 条未读）`;
}

function applyLaunchOnStartupPreference() {
  const preferences = getDesktopPreferences();
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  app.setLoginItemSettings({
    openAtLogin: Boolean(preferences.launchOnStartup),
  });
}

function publishDesktopPreferences() {
  const payload = { preferences: getDesktopPreferences(), storage: getStorageInfo() };
  getLiveWindows().forEach((window) => {
    window.webContents.send("desktop:preferences-changed", payload);
  });
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
    tray.setToolTip(buildTrayTooltip());
    tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
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
  if (window.isMinimized()) {
    window.restore();
  }
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

function destroyTray() {
  if (!tray) return;
  tray.removeAllListeners();
  tray.destroy();
  tray = null;
}

function hideAllChatWindows() {
  for (const window of chatWindows.values()) {
    if (!window || window.isDestroyed()) continue;
    window.hide();
  }
}

function showPrimaryWindowFromTray() {
  if (listWindow && !listWindow.isDestroyed()) {
    restoreListWindowPosition();
    focusWindow(listWindow);
    return;
  }

  if (loginWindow && !loginWindow.isDestroyed()) {
    focusWindow(loginWindow);
    return;
  }

  createLoginWindow();
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

function shouldSuppressDesktopNotification(conversationId = "") {
  const targetConversationId = String(conversationId || "").trim();
  if (!targetConversationId) return false;
  for (const [windowId, context] of windowContextById.entries()) {
    const currentWindow = BrowserWindow.fromId(windowId);
    if (!currentWindow || currentWindow.isDestroyed() || currentWindow.isMinimized() || !currentWindow.isVisible()) continue;
    if (!currentWindow.isFocused()) continue;
    if (String(context?.conversationId || "").trim() === targetConversationId) return true;
  }
  return false;
}

function showDesktopNotification({ title, body, conversationId = "" }) {
  if (getDesktopPreferences().notificationsMuted) return false;
  if (shouldSuppressDesktopNotification(conversationId)) return false;
  if (!Notification.isSupported()) return false;
  const notification = new Notification({
    title: String(title || "Linksee Chat"),
    body: String(body || "你收到一条新消息"),
    silent: true,
    icon: resolveTrayIconPath() || undefined,
  });
  notification.on("click", () => {
    if (conversationId) {
      createListWindow();
      createChatWindow(conversationId);
      return;
    }
    showPrimaryWindowFromTray();
  });
  notification.show();
  return true;
}

function clearSessionStorageInWindow(window) {
  if (!window || window.isDestroyed()) return Promise.resolve();
  return window.webContents.executeJavaScript(`
    ["chat_access_token","chat_refresh_token","chat_user_id","chat_role"].forEach((key) => window.localStorage.removeItem(key));
  `, true).catch(() => {});
}

async function logoutToLoginFromTray() {
  await Promise.all(getLiveWindows().map((window) => clearSessionStorageInWindow(window)));
  if (listWindow && !listWindow.isDestroyed()) {
    listWindow.destroy();
    listWindow = null;
  }
  closeAllChatWindows();
  createLoginWindow();
}

function buildTrayMenuTemplate() {
  const preferences = getDesktopPreferences();
  return [
    { label: "打开主窗口", click: () => { showPrimaryWindowFromTray(); } },
    { label: preferences.notificationsMuted ? "关闭消息免打扰" : "消息免打扰", click: () => { updateDesktopPreferences({ notificationsMuted: !getDesktopPreferences().notificationsMuted }); } },
    { label: "退出登录", click: () => { logoutToLoginFromTray().catch(() => {}); } },
    {
      type: "separator",
    },
    { label: "退出程序", click: () => { quitDesktopApp(); } },
  ];
}

function ensureTray() {
  if (tray && !tray.isDestroyed?.()) return tray;

  tray = new Tray(createTrayIcon());
  tray.setToolTip(buildTrayTooltip());
  tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
  tray.on("double-click", () => {
    showPrimaryWindowFromTray();
  });
  tray.on("click", () => {
    showPrimaryWindowFromTray();
  });

  return tray;
}

function quitDesktopApp() {
  if (isQuitting) return;
  isQuitting = true;
  destroyTray();
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
    hideAllChatWindows();
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

function registerIpcHandlers() {
  ipcMain.handle("desktop:get-window-state", (event) => buildWindowState(resolveWindowByEvent(event)));
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
  ipcMain.handle("desktop:get-update-state", () => updateState);
  ipcMain.handle("desktop:check-for-updates", async () => {
    if (!app.isPackaged) {
      return publishUpdateState({
        status: "unavailable",
        available: false,
        error: "开发模式不执行自动更新",
      });
    }
    await autoUpdater.checkForUpdates();
    return updateState;
  });
  ipcMain.handle("desktop:download-update", async () => {
    if (!app.isPackaged) return updateState;
    publishUpdateState({ status: "downloading", error: "" });
    await autoUpdater.downloadUpdate();
    return updateState;
  });
  ipcMain.handle("desktop:install-update", () => {
    if (!app.isPackaged || !updateState.downloaded) return updateState;
    isQuitting = true;
    publishUpdateState({ status: "installing", error: "" });
    autoUpdater.quitAndInstall(false, true);
    return updateState;
  });
  ipcMain.handle("desktop:update-window-context", (event, payload = {}) => {
    const currentWindow = resolveWindowByEvent(event);
    setWindowContext(currentWindow, payload || {});
    return true;
  });
  ipcMain.handle("desktop:resolve-avatar-source", async (_event, sourceUrl) => {
    try {
      return await ensureRemoteAvatarCached(sourceUrl);
    } catch {
      return String(sourceUrl || "");
    }
  });
  ipcMain.handle("desktop:save-downloaded-file", (_event, payload = {}) => {
    return saveDownloadedAsset({
      fileName: payload.fileName,
      bytes: payload.bytes,
      conversationId: payload.conversationId,
      cacheKey: payload.cacheKey,
    });
  });
  ipcMain.handle("desktop:read-state-cache", (_event, payload = {}) => {
    return readStateCache(payload.scope, payload.key);
  });
  ipcMain.handle("desktop:write-state-cache", (_event, payload = {}) => {
    return writeStateCache(payload.scope, payload.key, payload.data);
  });
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
  ipcMain.handle("desktop:choose-directory", async (_event, options = {}) => {
    const result = await dialog.showOpenDialog({
      title: options?.title || "选择目录",
      defaultPath: String(options?.defaultPath || "").trim() || getStorageInfo().exports,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths?.[0]) return "";
    return result.filePaths[0];
  });
  ipcMain.handle("desktop:list-stickers", () => listStickerEntries());
  ipcMain.handle("desktop:import-sticker-files", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入表情图片",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "Images", extensions: Array.from(STICKER_EXTENSIONS).map((item) => item.replace(/^\./, "")) }],
    });
    if (result.canceled || !result.filePaths?.length) return listStickerEntries();
    result.filePaths.forEach((filePath) => copyStickerIntoLibrary(filePath));
    return listStickerEntries();
  });
  ipcMain.handle("desktop:import-sticker-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "导入表情文件夹",
      properties: ["openDirectory"],
    });
    if (result.canceled || !result.filePaths?.[0]) return listStickerEntries();
    const folderPath = result.filePaths[0];
    const files = walkStickerFiles(folderPath).slice(0, 200);
    const prefix = sanitizeStickerName(path.basename(folderPath));
    files.forEach((filePath) => copyStickerIntoLibrary(filePath, prefix));
    return listStickerEntries();
  });
  ipcMain.handle("desktop:minimize", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    window.minimize();
    return buildWindowState(window);
  });
  ipcMain.handle("desktop:toggle-maximize", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
    return buildWindowState(window);
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
    if (listWindow && !listWindow.isDestroyed()) {
      listWindow.destroy();
      listWindow = null;
    }
    closeAllChatWindows();
    createLoginWindow();
    return true;
  });
  ipcMain.handle("desktop:show-notification", (_event, payload) => {
    return showDesktopNotification(payload || {});
  });
  ipcMain.handle("desktop:beep", () => {
    shell.beep();
    return true;
  });
  ipcMain.handle("desktop:update-unread-count", (_event, nextCount) => {
    unreadCount = Math.max(0, Number(nextCount || 0));
    if (tray && !tray.isDestroyed?.()) {
      tray.setToolTip(buildTrayTooltip());
      tray.setContextMenu(Menu.buildFromTemplate(buildTrayMenuTemplate()));
    }
    return unreadCount;
  });
}

registerIpcHandlers();
registerAutoUpdaterEvents();

app.on("before-quit", () => {
  isQuitting = true;
  destroyTray();
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
  ensureTray();
  createLoginWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showPrimaryWindowFromTray();
    } else {
      showPrimaryWindowFromTray();
    }
  });
}).catch((error) => {
  console.error("[desktop] startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return;
});
