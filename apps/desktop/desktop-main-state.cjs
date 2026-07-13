function createDesktopMainState({ buildWindowState, createScreenshotSelectionManager, runtime }) {
  const windows = {
    loginWindow: null,
    listWindow: null,
    chatWindows: new Map(),
    windowContextById: new Map(),
    tray: null,
    listWindowBoundsSnapshot: null,
    listWindowAnimating: false,
  };

  const screenshotSelection = createScreenshotSelectionManager({
    preloadPath: runtime.screenshotSelectionPreloadPath,
  });

  function sendWindowState(window) {
    if (!window || window.isDestroyed()) return;
    window.webContents.send("desktop:window-state", buildWindowState(window));
  }

  function buildArguments({ kind, conversationId = "" }) {
    return [
      `--remote-origin=${runtime.targetOrigin}`,
      `--window-kind=${kind}`,
      `--conversation-id=${conversationId}`,
    ];
  }

  function hideWindowToTray(window) {
    if (!window || window.isDestroyed()) return;
    window.hide();
  }

  function quitWindows() {
    for (const window of windows.chatWindows.values()) {
      if (window && !window.isDestroyed()) window.close();
    }
    if (windows.listWindow && !windows.listWindow.isDestroyed()) windows.listWindow.close();
    if (windows.loginWindow && !windows.loginWindow.isDestroyed()) windows.loginWindow.close();
  }

  return {
    buildArguments,
    desktopAppState: {
      unreadCount: 0,
      isQuitting: false,
      getLoginWindow: () => windows.loginWindow,
      setListWindow: (value) => {
        windows.listWindow = value;
      },
      getListWindow: () => windows.listWindow,
      getTray: () => windows.tray,
      clearWindows: () => {
        windows.chatWindows.clear();
        windows.listWindow = null;
        windows.loginWindow = null;
      },
    },
    desktopWindowState: {
      chatWindows: windows.chatWindows,
      get listWindow() { return windows.listWindow; },
      set listWindow(value) { windows.listWindow = value; },
      get listWindowBoundsSnapshot() { return windows.listWindowBoundsSnapshot; },
      set listWindowBoundsSnapshot(value) { windows.listWindowBoundsSnapshot = value; },
      get loginWindow() { return windows.loginWindow; },
      set loginWindow(value) { windows.loginWindow = value; },
      get listWindowAnimating() { return windows.listWindowAnimating; },
      set listWindowAnimating(value) { windows.listWindowAnimating = value; },
    },
    hideWindowToTray,
    quitWindows,
    screenshotSelection,
    sendWindowState,
    windows,
  };
}

module.exports = {
  createDesktopMainState,
};
