const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

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

function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

function readRemoteOrigin() {
  const envOrigin = normalizeOrigin(process.env.DESKTOP_REMOTE_ORIGIN);
  if (envOrigin) return envOrigin;

  for (const file of configCandidates) {
    try {
      if (!file || !fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const remoteOrigin = normalizeOrigin(parsed?.remoteOrigin);
      if (remoteOrigin) return remoteOrigin;
    } catch (error) {
      console.error(`[desktop] failed to read config ${file}`, error);
    }
  }

  return DEFAULT_REMOTE_ORIGIN;
}

const remoteOrigin = readRemoteOrigin();
const localOrigin = `http://127.0.0.1:${port}`;
const targetOrigin = remoteOrigin || localOrigin;

let loginWindow = null;
let listWindow = null;
const chatWindows = new Map();

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

function createLoginWindow() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    focusWindow(loginWindow);
    return loginWindow;
  }

  loginWindow = createShellWindow({
    width: 360,
    height: 500,
    minWidth: 360,
    minHeight: 500,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Linksee Chat 登录",
    backgroundColor: "#edf3fb",
    pagePath: loginPagePath,
    kind: "login",
  });

  loginWindow.on("closed", () => {
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
    width: 320,
    height: 760,
    minWidth: 300,
    minHeight: 680,
    maximizable: false,
    title: "Linksee Chat",
    backgroundColor: "#eef3f9",
    pagePath: listPagePath,
    kind: "list",
  });

  listWindow.on("closed", () => {
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
    title: "Linksee Chat 会话",
    backgroundColor: "#f3f6fb",
    pagePath: chatPagePath,
    pageQuery: { conversationId: key, mode: "conversation" },
    kind: "chat",
    conversationId: key,
  });

  chatWindow.on("closed", () => {
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
    return true;
  });
  ipcMain.handle("desktop:logout", () => {
    if (listWindow && !listWindow.isDestroyed()) {
      listWindow.close();
    }
    closeAllChatWindows();
    createLoginWindow();
    return true;
  });
}

registerIpcHandlers();

app.whenReady().then(async () => {
  createLoginWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoginWindow();
    }
  });
}).catch((error) => {
  console.error("[desktop] startup failed", error);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
