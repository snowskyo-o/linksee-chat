const {
  animateWindowBounds,
  buildWindowState,
  clearWindowContext,
  focusWindow,
  resolveWindowByEvent,
  setWindowContext,
  shouldSuppressDesktopNotification,
  snapshotWindowBounds,
  toggleWindowMaximize,
} = require("./desktop-window-utils.cjs");

function createDesktopWindowController(deps) {
  const {
    BrowserWindow,
    buildArguments,
    buildWindowState,
    chatPagePath,
    clearWindowContext,
    createLoginWindowRef,
    getDesktopPreferences,
    hideAllChatWindows,
    hideWindowToTray,
    isQuittingRef,
    listPagePath,
    loginPagePath,
    preloadPath,
    sendWindowState,
    setWindowContext,
    state,
    targetOrigin,
  } = deps;

  function getLiveWindows() {
    return [state.loginWindow, state.listWindow, ...state.chatWindows.values()].filter((window) => window && !window.isDestroyed());
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

  function slideOutListWindow() {
    const listWindow = state.listWindow;
    if (!listWindow || listWindow.isDestroyed() || state.listWindowAnimating) return;
    if (!listWindow.isVisible()) return;

    state.listWindowAnimating = true;
    state.listWindowBoundsSnapshot = snapshotWindowBounds(listWindow) || state.listWindowBoundsSnapshot;
    const fromBounds = snapshotWindowBounds(listWindow);
    if (!fromBounds) {
      state.listWindowAnimating = false;
      return;
    }

    const toBounds = {
      ...fromBounds,
      x: fromBounds.x + Math.round(fromBounds.width * 0.72),
    };

    animateWindowBounds(listWindow, fromBounds, toBounds, {
      duration: 180,
      onDone: () => {
        if (state.listWindow && !state.listWindow.isDestroyed()) {
          state.listWindow.hide();
          if (state.listWindowBoundsSnapshot) {
            state.listWindow.setBounds(state.listWindowBoundsSnapshot, false);
          }
        }
        state.listWindowAnimating = false;
      },
    });
  }

  function restoreListWindowPosition() {
    const listWindow = state.listWindow;
    if (!listWindow || listWindow.isDestroyed()) return;
    if (!state.listWindowBoundsSnapshot) {
      state.listWindowBoundsSnapshot = snapshotWindowBounds(listWindow);
      return;
    }
    listWindow.setBounds(state.listWindowBoundsSnapshot, false);
  }

  function createLoginWindow() {
    if (state.loginWindow && !state.loginWindow.isDestroyed()) {
      focusWindow(state.loginWindow);
      return state.loginWindow;
    }
    state.loginWindow = createShellWindow({
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
    setWindowContext(state.loginWindow, { kind: "login", conversationId: "" });

    state.loginWindow.on("close", (event) => {
      if (isQuittingRef()) return;
      if (!getDesktopPreferences().closeToTray) {
        createLoginWindowRef.quitDesktopApp();
        return;
      }
      event.preventDefault();
      hideWindowToTray(state.loginWindow);
    });

    state.loginWindow.on("closed", () => {
      clearWindowContext(state.loginWindow);
      state.loginWindow = null;
    });

    return state.loginWindow;
  }

  function createListWindow() {
    if (state.listWindow && !state.listWindow.isDestroyed()) {
      focusWindow(state.listWindow);
      return state.listWindow;
    }
    state.listWindow = createShellWindow({
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
    setWindowContext(state.listWindow, { kind: "list", conversationId: "" });

    state.listWindow.on("close", (event) => {
      if (isQuittingRef()) return;
      if (!getDesktopPreferences().closeToTray) {
        createLoginWindowRef.quitDesktopApp();
        return;
      }
      event.preventDefault();
      hideWindowToTray(state.listWindow);
      hideAllChatWindows(state.chatWindows);
    });

    state.listWindow.on("move", () => {
      if (state.listWindowAnimating || !state.listWindow || state.listWindow.isDestroyed() || !state.listWindow.isVisible()) return;
      state.listWindowBoundsSnapshot = snapshotWindowBounds(state.listWindow);
    });

    state.listWindow.on("closed", () => {
      clearWindowContext(state.listWindow);
      state.listWindow = null;
    });

    return state.listWindow;
  }

  function createChatWindow(conversationId) {
    const key = String(conversationId || "").trim();
    if (!key) return null;
    const existing = state.chatWindows.get(key);
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
      state.chatWindows.delete(key);
    });
    state.chatWindows.set(key, chatWindow);
    return chatWindow;
  }

  function closeAllChatWindows() {
    for (const window of state.chatWindows.values()) {
      if (window && !window.isDestroyed()) {
        window.close();
      }
    }
    state.chatWindows.clear();
  }

  return {
    buildWindowState,
    closeAllChatWindows,
    createChatWindow,
    createListWindow,
    createLoginWindow,
    createShellWindow,
    focusWindow,
    getLiveWindows,
    restoreListWindowPosition,
    slideOutListWindow,
  };
}

module.exports = {
  buildWindowState,
  createDesktopWindowController,
  focusWindow,
  resolveWindowByEvent,
  setWindowContext,
  clearWindowContext,
  shouldSuppressDesktopNotification,
  toggleWindowMaximize,
};
