const {
  buildWindowState,
  clearWindowContext,
  focusWindow,
  resolveWindowByEvent,
  setWindowContext,
  shouldSuppressDesktopNotification,
  toggleWindowMaximize,
} = require("./desktop-window-utils.cjs");
const { createDesktopListWindowController } = require("./desktop-window-list-controller.cjs");
const { createDesktopWindowFactories } = require("./desktop-window-factories.cjs");

function createDesktopWindowController(deps) {
  const {
    BrowserWindow,
    buildArguments,
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

  const listController = createDesktopListWindowController(state);
  const factories = createDesktopWindowFactories({
    clearWindowContext,
    createLoginWindowRef,
    getDesktopPreferences,
    hideAllChatWindows,
    hideWindowToTray,
    isQuittingRef,
    listController,
    setWindowContext,
    state,
    windowDeps: {
      BrowserWindow,
      buildArguments,
      chatPagePath,
      focusWindow,
      listPagePath,
      loginPagePath,
      preloadPath,
      sendWindowState,
      targetOrigin,
    },
  });

  return {
    buildWindowState,
    focusWindow,
    getLiveWindows() {
      return [state.loginWindow, state.listWindow, ...state.chatWindows.values()].filter((window) => window && !window.isDestroyed());
    },
    restoreListWindowPosition: listController.restoreListWindowPosition,
    slideOutListWindow: listController.slideOutListWindow,
    ...factories,
  };
}

module.exports = {
  buildWindowState,
  clearWindowContext,
  createDesktopWindowController,
  focusWindow,
  resolveWindowByEvent,
  setWindowContext,
  shouldSuppressDesktopNotification,
  toggleWindowMaximize,
};
