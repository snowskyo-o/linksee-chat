import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createDesktopMainContext } = require("../../apps/desktop/desktop-main-context.cjs");
const { createDesktopMainControllers } = require("../../apps/desktop/desktop-main-controller-bootstrap.cjs");
const { createDesktopAppController } = require("../../apps/desktop/desktop-app-controller.cjs");
const { createDesktopUpdateController } = require("../../apps/desktop/desktop-updates.cjs");
const desktopWindows = require("../../apps/desktop/desktop-windows.cjs");
const tray = require("../../apps/desktop/desktop-tray.cjs");

function createWindowStub() {
  const handlers = new Map();
  return {
    id: Math.floor(Math.random() * 10000),
    webContents: { send() {}, isLoadingMainFrame: () => false, once() {} },
    isDestroyed: () => false,
    isFocused: () => true,
    isFullScreen: () => false,
    isMaximized: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    close() {},
    focus() {},
    getBounds: () => ({ x: 0, y: 0, width: 420, height: 560 }),
    getTitle: () => "Linksee Chat",
    hide() {},
    loadFile: () => Promise.resolve(),
    maximize() {},
    minimize() {},
    on(event, handler) { handlers.set(event, handler); },
    once(event, handler) { handlers.set(`once:${event}`, handler); },
    restore() {},
    setBounds() {},
    setTitle() {},
    show() {},
    unmaximize() {},
  };
}

const BrowserWindow = function BrowserWindowStub() {
  return createWindowStub();
};

const context = createDesktopMainContext({
  __dirname: path.join(process.cwd(), "apps/desktop"),
  buildWindowState: desktopWindows.buildWindowState,
  createScreenshotSelectionManager: () => ({ cancelScreenshotSelection() {}, captureRegionScreenshot() {}, completeScreenshotSelection() {} }),
  processEnv: process.env,
  processExecPath: process.execPath,
  processResourcesPath: process.cwd(),
});

const deps = {
  BrowserWindow,
  Menu: { buildFromTemplate() { return {}; } },
  Tray: function TrayStub() { return { destroy() {}, isDestroyed: () => false, on() {}, removeAllListeners() {}, setContextMenu() {}, setToolTip() {} }; },
  app: { getPath: () => "C:/Users/test/AppData/Roaming/Linksee Chat", quit() {}, setLoginItemSettings() {} },
  autoUpdater: { on() {} },
  buildTrayMenu: tray.buildTrayMenu,
  buildTrayTooltip: tray.buildTrayTooltip,
  context,
  createDesktopAppController,
  createDesktopUpdateController,
  createDesktopWindowController: desktopWindows.createDesktopWindowController,
  destroyTray: tray.destroyTray,
  ensureStorageDirectories() {},
  ensureTray: tray.ensureTray,
  focusWindow: desktopWindows.focusWindow,
  fs: { existsSync: () => false },
  getDefaultDesktopPreferences: () => ({ closeToTray: true, downloadsDir: "C:/Downloads", launchOnStartup: false, notificationsMuted: false }),
  getDesktopPreferences: () => ({ closeToTray: true, downloadsDir: "C:/Downloads", launchOnStartup: false, notificationsMuted: false }),
  getStorageInfo: () => ({ root: "C:/Users/test/AppData/Roaming/Linksee Chat" }),
  hideAllChatWindows: tray.hideAllChatWindows,
  logoutToLoginFromTray: async () => {},
  nativeImage: { createFromDataURL: () => ({ resize() { return this; } }), createFromPath: () => ({ isEmpty: () => true, resize() { return this; } }) },
  path,
  resolveTrayIconPath: tray.resolveTrayIconPath,
  setWindowContext: desktopWindows.setWindowContext,
  trayDeps: { createTrayIcon: tray.createTrayIcon, showPrimaryWindowFromTray: tray.showPrimaryWindowFromTray },
  windowHelpers: { buildWindowState: desktopWindows.buildWindowState, clearWindowContext: desktopWindows.clearWindowContext },
  writeDesktopPreferences() {},
};

const { desktopApp, desktopWindows: desktopWindowController } = createDesktopMainControllers(deps);

assert.equal(typeof desktopApp.handleReady, "function");
assert.equal(typeof desktopWindowController.createLoginWindow, "function");
desktopApp.handleReady();
assert.ok(context.windows.tray, "tray should be created during startup");
assert.ok(context.windows.loginWindow, "login window should be created during startup");

console.log("[desktop-smoke] startup wiring ok");
