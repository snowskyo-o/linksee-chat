function createDesktopAppController(deps) {
  const {
    app,
    Menu,
    buildTrayMenu,
    buildTrayTooltip,
    closeAllChatWindows,
    createLoginWindow,
    createTrayIcon,
    destroyTray,
    ensureStorageDirectories,
    ensureTray,
    focusWindow,
    getDefaultDesktopPreferences,
    getDesktopPreferences,
    getLiveWindows,
    getStorageInfo,
    logoutToLoginFromTray,
    quitWindows,
    restoreListWindowPosition,
    setTray,
    showPrimaryWindowFromTray,
    state,
    updateTrayMenu,
    writeDesktopPreferences,
  } = deps;

  function setUnreadCount(nextCount) {
    state.unreadCount = Math.max(0, Number(nextCount || 0));
    return state.unreadCount;
  }

  function markAppQuitting() {
    state.isQuitting = true;
  }

  function applyLaunchOnStartupPreference() {
    if (process.platform !== "win32" && process.platform !== "darwin") return;
    app.setLoginItemSettings({ openAtLogin: Boolean(getDesktopPreferences().launchOnStartup) });
  }

  function publishDesktopPreferences() {
    const payload = { preferences: getDesktopPreferences(), storage: getStorageInfo() };
    getLiveWindows().forEach((window) => window.webContents.send("desktop:preferences-changed", payload));
    return payload;
  }

  function openPrimaryFromTray() {
    showPrimaryWindowFromTray({
      listWindow: state.getListWindow(),
      loginWindow: state.getLoginWindow(),
      restoreListWindowPosition,
      focusWindow,
      createLoginWindow,
    });
  }

  function quitDesktopApp() {
    if (state.isQuitting) return;
    state.isQuitting = true;
    setTray(destroyTray(state.getTray()));
    quitWindows();
    app.quit();
  }

  function logout() {
    const listWindow = state.getListWindow();
    if (listWindow && !listWindow.isDestroyed()) {
      listWindow.destroy();
      state.setListWindow(null);
    }
    closeAllChatWindows();
    createLoginWindow();
  }

  function buildTrayMenuForApp() {
    return buildTrayMenu({
      Menu,
      getDesktopPreferences,
      updateDesktopPreferences,
      showPrimaryWindowFromTray: openPrimaryFromTray,
      logoutToLoginFromTray: () => logoutToLoginFromTray({
        getLiveWindows,
        listWindow: () => state.getListWindow(),
        closeAllChatWindows,
        createLoginWindow,
      }),
      quitDesktopApp,
    });
  }

  function updateDesktopPreferences(patch = {}) {
    const current = getDesktopPreferences();
    const next = { ...current, ...patch };
    if (!String(next.downloadsDir || "").trim()) next.downloadsDir = getDefaultDesktopPreferences().downloadsDir;
    writeDesktopPreferences(next);
    ensureStorageDirectories();
    applyLaunchOnStartupPreference();
    updateTrayMenu(buildTrayTooltip(state.unreadCount), buildTrayMenuForApp);
    return publishDesktopPreferences();
  }

  function handleBeforeQuit() {
    state.isQuitting = true;
    setTray(destroyTray(state.getTray()));
  }

  function handleWillQuit() {
    state.clearWindows();
  }

  function handleReady() {
    getDesktopPreferences();
    applyLaunchOnStartupPreference();
    ensureStorageDirectories();
    setTray(ensureTray({
      existingTray: state.getTray(),
      Tray: deps.Tray,
      createTrayIcon,
      buildTrayTooltip,
      unreadCount: state.unreadCount,
      buildTrayMenu: buildTrayMenuForApp,
      showPrimaryWindowFromTray: openPrimaryFromTray,
    }));
    createLoginWindow();
  }

  return {
    applyLaunchOnStartupPreference,
    buildTrayMenuForApp,
    handleBeforeQuit,
    handleReady,
    handleWillQuit,
    logout,
    markAppQuitting,
    openPrimaryFromTray,
    publishDesktopPreferences,
    quitDesktopApp,
    setUnreadCount,
    updateDesktopPreferences,
  };
}

module.exports = {
  createDesktopAppController,
};
