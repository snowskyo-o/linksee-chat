const { BrowserWindow } = require("electron");
const { buildImagePayload, captureDisplayScreenshot, cropScreenshot, resolveCaptureDisplay } = require("./desktop-media.cjs");
const { buildScreenshotSelectionPage } = require("./screenshot-selection-page.cjs");
const {
  clearScreenshotSelectionSession,
  createDeferred,
  getScreenshotSelectionSession,
  setScreenshotSelectionSession,
} = require("./screenshot-selection-session.cjs");

function createSelectionWindow({ display, preloadPath }) {
  return new BrowserWindow({
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
}

function createScreenshotSelectionManager({ preloadPath }) {
  async function captureRegionScreenshot() {
    const activeSession = getScreenshotSelectionSession();
    if (activeSession) return activeSession.deferred.promise;
    const display = resolveCaptureDisplay();
    const sourceImage = await captureDisplayScreenshot(display);
    const selectionWindow = createSelectionWindow({ display, preloadPath });
    const deferred = createDeferred();
    setScreenshotSelectionSession({ deferred, display, sourceImage, window: selectionWindow });
    selectionWindow.once("ready-to-show", () => {
      selectionWindow.setAlwaysOnTop(true, "screen-saver");
      selectionWindow.show();
      selectionWindow.focus();
    });
    selectionWindow.on("closed", () => {
      clearScreenshotSelectionSession({ mode: "resolve", payload: { canceled: true } });
    });
    await selectionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildScreenshotSelectionPage({
      imageDataUrl: sourceImage.toDataURL(),
      display,
    }))}`);
    return deferred.promise;
  }

  function completeScreenshotSelection(payload = {}) {
    const activeSession = getScreenshotSelectionSession();
    if (!activeSession) return { canceled: true };
    const cropped = cropScreenshot(activeSession.sourceImage, payload, activeSession.display.scaleFactor);
    clearScreenshotSelectionSession({ mode: "resolve", payload: buildImagePayload(cropped) });
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
