const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_REMOTE_ORIGIN = "http://186.241.89.102:3010";
const projectRoot = path.resolve(__dirname, "../..");
const port = process.env.DESKTOP_PORT || process.env.PORT || "3010";
const preloadPath = path.join(__dirname, "preload.cjs");
const rendererRoot = path.join(projectRoot, "apps", "web", "dist");
const loginPagePath = path.join(rendererRoot, "login.html");
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

const remoteOrigin = readRemoteOrigin();
const localOrigin = `http://127.0.0.1:${port}`;
const targetOrigin = remoteOrigin || localOrigin;

let mainWindow = null;

function registerIpcHandlers() {
  ipcMain.handle("desktop:get-window-state", () => buildWindowState(mainWindow));
  ipcMain.handle("desktop:get-runtime-config", () => ({
    serverOrigin: targetOrigin,
  }));
  ipcMain.handle("desktop:minimize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    mainWindow.minimize();
    return buildWindowState(mainWindow);
  });
  ipcMain.handle("desktop:toggle-maximize", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
    return buildWindowState(mainWindow);
  });
  ipcMain.handle("desktop:close", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    mainWindow.close();
    return null;
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#e9eef5",
    autoHideMenuBar: true,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: process.platform === "darwin" ? { x: 18, y: 18 } : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--remote-origin=${targetOrigin}`],
    },
  });

  mainWindow.on("maximize", () => sendWindowState(mainWindow));
  mainWindow.on("unmaximize", () => sendWindowState(mainWindow));
  mainWindow.on("enter-full-screen", () => sendWindowState(mainWindow));
  mainWindow.on("leave-full-screen", () => sendWindowState(mainWindow));
  mainWindow.once("ready-to-show", () => sendWindowState(mainWindow));

  await mainWindow.loadFile(loginPagePath);
}

registerIpcHandlers();

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
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
