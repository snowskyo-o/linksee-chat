const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const projectRoot = path.resolve(__dirname, "../..");
const port = process.env.DESKTOP_PORT || process.env.PORT || "3010";
const preloadPath = path.join(__dirname, "preload.cjs");
const configCandidates = [
  path.join(projectRoot, "desktop-config.json"),
  path.join(path.dirname(process.execPath), "desktop-config.json"),
];

function readRemoteOrigin() {
  const envOrigin = String(process.env.DESKTOP_REMOTE_ORIGIN || "").replace(/\/$/, "");
  if (envOrigin) return envOrigin;

  for (const file of configCandidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const remoteOrigin = String(parsed?.remoteOrigin || "").replace(/\/$/, "");
      if (remoteOrigin) return remoteOrigin;
    } catch (error) {
      console.error(`[desktop] failed to read config ${file}`, error);
    }
  }

  return "";
}

const remoteOrigin = readRemoteOrigin();
const serverEntry = path.join(projectRoot, "apps", "api", "src", "server", "index.mjs");

let backendProcess = null;

function waitForServer(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tryConnect, 400);
      });
    }

    tryConnect();
  });
}

async function createWindow() {
  const window = new BrowserWindow({
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

  const targetOrigin = remoteOrigin || `http://127.0.0.1:${port}`;
  await window.loadURL(`${targetOrigin}/chat/login.html`);
}

async function startBackend() {
  if (remoteOrigin) return;

  backendProcess = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  backendProcess.on("exit", (code) => {
    if (!app.isQuitting) {
      console.error(`[desktop] backend exited with code ${code ?? 0}`);
    }
  });

  await waitForServer(`http://127.0.0.1:${port}/health`);
}

app.whenReady().then(async () => {
  await startBackend();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
}).catch((error) => {
  console.error("[desktop] startup failed", error);
  app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
