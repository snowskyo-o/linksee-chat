function createDesktopMainControllers(deps) {
  const {
    BrowserWindow,
    Menu,
    Tray,
    app,
    autoUpdater,
    buildTrayMenu,
    buildTrayTooltip,
    context,
    createDesktopAppController,
    createDesktopUpdateController,
    createDesktopWindowController,
    destroyTray,
    ensureStorageDirectories,
    ensureTray,
    focusWindow,
    getDefaultDesktopPreferences,
    getDesktopPreferences,
    getStorageInfo,
    hideAllChatWindows,
    logoutToLoginFromTray,
    nativeImage,
    path,
    resolveTrayIconPath,
    setWindowContext,
    windowHelpers,
    writeDesktopPreferences,
    trayDeps,
  } = deps;

  let desktopApp = null;
  const desktopWindows = createDesktopWindowController({
    BrowserWindow,
    buildArguments: context.buildArguments,
    buildWindowState: windowHelpers.buildWindowState,
    chatPagePath: context.chatPagePath,
    clearWindowContext: (window) => windowHelpers.clearWindowContext(context.windows.windowContextById, window),
    createLoginWindowRef: { quitDesktopApp: () => desktopApp?.quitDesktopApp() },
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
  });

  const desktopUpdates = createDesktopUpdateController({
    autoUpdater,
    getLiveWindows: desktopWindows.getLiveWindows,
  });

  function showPrimaryWindowFromTray(args) {
    return trayDeps.showPrimaryWindowFromTray({
      ...args,
      listWindow: context.windows.listWindow,
      loginWindow: context.windows.loginWindow,
    });
  }

  desktopApp = createDesktopAppController({
    app,
    Menu,
    Tray,
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
  });

  return {
    desktopApp,
    desktopUpdates,
    desktopWindows,
  };
}

module.exports = {
  createDesktopMainControllers,
};
