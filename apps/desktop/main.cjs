const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const DEFAULT_REMOTE_ORIGIN = "http://186.241.89.102:3010";
const projectRoot = path.resolve(__dirname, "../..");
const port = process.env.DESKTOP_PORT || process.env.PORT || "3010";
const preloadPath = path.join(__dirname, "preload.cjs");
const offlinePagePath = path.join(__dirname, "offline.html");
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
const targetUrl = `${targetOrigin}/login`;

let mainWindow = null;

function buildOfflineUrl(reason = "") {
  const params = new URLSearchParams({
    target: targetUrl,
    server: targetOrigin,
    reason,
  });
  return `file://${offlinePagePath.replace(/\\/g, "/")}?${params.toString()}`;
}

function waitForServer(url, timeoutMs = 5000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", (error) => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(error);
          return;
        }
        setTimeout(tryConnect, 400);
      });

      request.setTimeout(2500, () => {
        request.destroy(new Error("Server check timeout"));
      });
    }

    tryConnect();
  });
}

async function loadChatOrOffline(reason = "") {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  try {
    await waitForServer(`${targetOrigin}/health`);
    await mainWindow.loadURL(targetUrl);
  } catch (error) {
    const message = reason || error?.message || "Server unavailable";
    await mainWindow.loadURL(buildOfflineUrl(message));
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: "#f3f6fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on("did-fail-load", (_event, _errorCode, errorDescription, validatedUrl) => {
    if (!validatedUrl.startsWith("file://")) {
      mainWindow.loadURL(buildOfflineUrl(errorDescription)).catch((error) => {
        console.error("[desktop] failed to show offline page", error);
      });
    }
  });

  await loadChatOrOffline();
}

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
