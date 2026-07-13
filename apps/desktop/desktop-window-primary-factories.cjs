const { createDesktopShellWindow } = require("./desktop-window-shell.cjs");

function createPrimaryDesktopWindows(deps) {
  const {
    clearWindowContext,
    createLoginWindowRef,
    getDesktopPreferences,
    hideAllChatWindows,
    hideWindowToTray,
    isQuittingRef,
    listController,
    setWindowContext,
    state,
    windowDeps,
  } = deps;

  function createLoginWindow() {
    if (state.loginWindow && !state.loginWindow.isDestroyed()) {
      windowDeps.focusWindow(state.loginWindow);
      return state.loginWindow;
    }
    state.loginWindow = createDesktopShellWindow(windowDeps, {
      width: 420, height: 560, minWidth: 420, minHeight: 560,
      transparent: true, resizable: false, maximizable: false, fullscreenable: false,
      title: "Linksee Chat Login", backgroundColor: "#00000000", pagePath: windowDeps.loginPagePath, kind: "login",
    });
    setWindowContext(state.loginWindow, { kind: "login", conversationId: "" });
    state.loginWindow.on("close", (event) => {
      if (isQuittingRef()) return;
      if (!getDesktopPreferences().closeToTray) return void createLoginWindowRef.quitDesktopApp();
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
      windowDeps.focusWindow(state.listWindow);
      return state.listWindow;
    }
    state.listWindow = createDesktopShellWindow(windowDeps, {
      width: 344, height: 760, minWidth: 328, minHeight: 680,
      maximizable: false, title: "Linksee Chat", backgroundColor: "#eef3f9",
      pagePath: windowDeps.listPagePath, kind: "list",
    });
    setWindowContext(state.listWindow, { kind: "list", conversationId: "" });
    state.listWindow.on("close", (event) => {
      if (isQuittingRef()) return;
      if (!getDesktopPreferences().closeToTray) return void createLoginWindowRef.quitDesktopApp();
      event.preventDefault();
      hideWindowToTray(state.listWindow);
      hideAllChatWindows(state.chatWindows);
    });
    listController.bindListWindowMoveTracking();
    state.listWindow.on("closed", () => {
      clearWindowContext(state.listWindow);
      state.listWindow = null;
    });
    return state.listWindow;
  }

  return { createListWindow, createLoginWindow };
}

module.exports = {
  createPrimaryDesktopWindows,
};
