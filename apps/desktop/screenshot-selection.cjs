const { BrowserWindow } = require("electron");
const { buildImagePayload, captureDisplayScreenshot, cropScreenshot, resolveCaptureDisplay } = require("./desktop-media.cjs");

let screenshotSelectionSession = null;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createDeferred() {
  let resolve = () => {};
  let reject = () => {};
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function buildScreenshotSelectionPage({ imageDataUrl, display }) {
  const width = Math.max(1, Number(display?.bounds?.width) || 1);
  const height = Math.max(1, Number(display?.bounds?.height) || 1);
  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>选择截图区域</title>
        <style>
          :root { color-scheme: dark; }
          * { box-sizing: border-box; user-select: none; }
          html, body {
            margin: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            cursor: crosshair;
            background: rgba(8, 12, 20, 0.36);
            font-family: "Microsoft YaHei UI", "PingFang SC", sans-serif;
          }
          #app {
            position: relative;
            width: ${width}px;
            height: ${height}px;
            background: center / cover no-repeat url("${imageDataUrl}");
          }
          #mask {
            position: absolute;
            inset: 0;
            background: rgba(8, 12, 20, 0.46);
          }
          #selection {
            position: absolute;
            display: none;
            border: 1px solid rgba(255, 255, 255, 0.98);
            box-shadow: 0 0 0 9999px rgba(8, 12, 20, 0.48);
            background: transparent;
          }
          #selection::after {
            content: "";
            position: absolute;
            inset: 0;
            background: center / ${width}px ${height}px no-repeat url("${imageDataUrl}");
            background-position: calc(-1px - var(--offset-x, 0px)) calc(-1px - var(--offset-y, 0px));
          }
          #hint {
            position: absolute;
            top: 22px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(8, 12, 20, 0.72);
            color: #f7fbff;
            font-size: 13px;
            line-height: 1;
            letter-spacing: 0.02em;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div id="app">
          <div id="mask"></div>
          <div id="selection"></div>
          <div id="hint">${escapeHtml("拖拽选择截图区域，按 Esc 取消")}</div>
        </div>
        <script>
          const shell = window.screenshotSelection;
          const root = document.getElementById("app");
          const selection = document.getElementById("selection");
          let startPoint = null;
          let dragging = false;

          function clampPoint(event) {
            const rect = root.getBoundingClientRect();
            return {
              x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
              y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
            };
          }

          function drawSelection(currentPoint) {
            if (!startPoint || !currentPoint) return;
            const x = Math.min(startPoint.x, currentPoint.x);
            const y = Math.min(startPoint.y, currentPoint.y);
            const width = Math.abs(currentPoint.x - startPoint.x);
            const height = Math.abs(currentPoint.y - startPoint.y);
            selection.style.display = "block";
            selection.style.left = x + "px";
            selection.style.top = y + "px";
            selection.style.width = width + "px";
            selection.style.height = height + "px";
            selection.style.setProperty("--offset-x", x + "px");
            selection.style.setProperty("--offset-y", y + "px");
          }

          function buildPayload(currentPoint) {
            const x = Math.min(startPoint.x, currentPoint.x);
            const y = Math.min(startPoint.y, currentPoint.y);
            return {
              x,
              y,
              width: Math.abs(currentPoint.x - startPoint.x),
              height: Math.abs(currentPoint.y - startPoint.y),
            };
          }

          root.addEventListener("mousedown", (event) => {
            if (event.button !== 0) return;
            dragging = true;
            startPoint = clampPoint(event);
            drawSelection(startPoint);
          });

          window.addEventListener("mousemove", (event) => {
            if (!dragging || !startPoint) return;
            drawSelection(clampPoint(event));
          });

          window.addEventListener("mouseup", async (event) => {
            if (!dragging || !startPoint) return;
            dragging = false;
            const payload = buildPayload(clampPoint(event));
            if (payload.width < 8 || payload.height < 8) {
              selection.style.display = "none";
              startPoint = null;
              return;
            }
            await shell.complete(payload);
          });

          window.addEventListener("keydown", async (event) => {
            if (event.key === "Escape") await shell.cancel();
          });

          window.addEventListener("contextmenu", (event) => event.preventDefault());
        </script>
      </body>
    </html>
  `.trim();
}

function clearScreenshotSelectionSession({ mode = "resolve", payload = { canceled: true } } = {}) {
  if (!screenshotSelectionSession) return false;
  const session = screenshotSelectionSession;
  screenshotSelectionSession = null;
  if (session.window && !session.window.isDestroyed()) {
    session.window.destroy();
  }
  if (mode === "reject") {
    session.deferred.reject(payload);
  } else {
    session.deferred.resolve(payload);
  }
  return true;
}

function createScreenshotSelectionManager({ preloadPath }) {
  async function captureRegionScreenshot() {
    if (screenshotSelectionSession) {
      return screenshotSelectionSession.deferred.promise;
    }
    const display = resolveCaptureDisplay();
    const sourceImage = await captureDisplayScreenshot(display);
    const imageDataUrl = sourceImage.toDataURL();
    const selectionWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      movable: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: true,
      fullscreenable: false,
      skipTaskbar: true,
      autoHideMenuBar: true,
      frame: false,
      transparent: true,
      show: false,
      alwaysOnTop: true,
      fullscreen: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const deferred = createDeferred();
    screenshotSelectionSession = { deferred, display, sourceImage, window: selectionWindow };
    selectionWindow.once("ready-to-show", () => {
      selectionWindow.setAlwaysOnTop(true, "screen-saver");
      selectionWindow.show();
      selectionWindow.focus();
    });
    selectionWindow.on("closed", () => {
      clearScreenshotSelectionSession({ mode: "resolve", payload: { canceled: true } });
    });
    await selectionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildScreenshotSelectionPage({ imageDataUrl, display }))}`);
    return deferred.promise;
  }

  function completeScreenshotSelection(payload = {}) {
    if (!screenshotSelectionSession) return { canceled: true };
    const cropped = cropScreenshot(
      screenshotSelectionSession.sourceImage,
      payload,
      screenshotSelectionSession.display.scaleFactor,
    );
    clearScreenshotSelectionSession({
      mode: "resolve",
      payload: buildImagePayload(cropped),
    });
    return { ok: true };
  }

  function cancelScreenshotSelection() {
    clearScreenshotSelectionSession({ mode: "resolve", payload: { canceled: true } });
    return { canceled: true };
  }

  return {
    cancelScreenshotSelection,
    captureRegionScreenshot,
    completeScreenshotSelection,
  };
}

module.exports = {
  createScreenshotSelectionManager,
};
