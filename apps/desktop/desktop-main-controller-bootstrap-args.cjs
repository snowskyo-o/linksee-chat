function createDesktopWindowControllerArgs(deps, desktopAppRef) {
  const { BrowserWindow, context, getDesktopPreferences, hideAllChatWindows, setWindowContext, windowHelpers } = deps;
  return {
    BrowserWindow,
    buildArguments: context.buildArguments,
    buildWindowState: windowHelpers.buildWindowState,
    chatPagePath: context.chatPagePath,
    clearWindowContext: (window) => windowHelpers.clearWindowContext(context.windows.windowContextById, window),
    createLoginWindowRef: { quitDesktopApp: () => desktopAppRef.current?.quitDesktopApp() },
    getDesktopPreferences,
    hideAllChatWindows,
    hideWindowToTray: context.hideWindowToTray,
    isQuittingRef: () => context.desktopAppState.isQuitting,
    listPagePath: context.listPagePath,
    loginPagePath: context.loginPagePath,
    preloadPath: context.preloadPath,
    sendWindowState: context.sendWindowState,
    setWindowContext: (window, nextContext) => setWindowContext(context.windows.windowContextById, window, nextContext),
    state: context.desktopWindowState,
    targetOrigin: context.targetOrigin,
  };
}

function createDesktopAppControllerArgs(deps, desktopWindows, showPrimaryWindowFromTray) {
  const {
    Menu,
    Tray,
    app,
    buildTrayMenu,
    buildTrayTooltip,
    context,
    destroyTray,
    ensureStorageDirectories,
    ensureTray,
    focusWindow,
    getDefaultDesktopPreferences,
    getDesktopPreferences,
    getStorageInfo,
    logoutToLoginFromTray,
    nativeImage,
    path,
    resolveTrayIconPath,
    trayDeps,
    writeDesktopPreferences,
  } = deps;

  return {
    Menu,
    Tray,
    app,
    buildTrayMenu,
    buildTrayTooltip,
    closeAllChatWindows: desktopWindows.closeAllChatWindows,
    createLoginWindow: desktopWindows.createLoginWindow,
    createTrayIcon: () => trayDeps.createTrayIcon({
      nativeImage,
      resolveTrayIconPath: () => resolveTrayIconPath({ path, process, projectRoot: context.projectRoot }),
    }),
    destroyTray,
    ensureStorageDirectories,
    ensureTray,
    focusWindow,
    getDefaultDesktopPreferences,
    getDesktopPreferences,
    getLiveWindows: desktopWindows.getLiveWindows,
    getStorageInfo,
    logoutToLoginFromTray,
    quitWindows: context.quitWindows,
    restoreListWindowPosition: desktopWindows.restoreListWindowPosition,
    setTray: (value) => {
      context.windows.tray = value;
    },
    showPrimaryWindowFromTray,
    state: {
      ...context.desktopAppState,
      getLoginWindow: () => context.windows.loginWindow,
      getListWindow: () => context.windows.listWindow,
      getTray: () => context.windows.tray,
    },
    updateTrayMenu: (tooltip, buildMenu) => {
      if (context.windows.tray && !context.windows.tray.isDestroyed?.()) {
        context.windows.tray.setToolTip(tooltip);
        context.windows.tray.setContextMenu(buildMenu());
      }
    },
    writeDesktopPreferences,
  };
}

module.exports = {
  createDesktopAppControllerArgs,
  createDesktopWindowControllerArgs,
};
