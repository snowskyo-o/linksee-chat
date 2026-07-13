function createDesktopAppPreferenceController(deps) {
  const {
    app,
    buildTrayMenu,
    buildTrayTooltip,
    ensureStorageDirectories,
    focusWindow,
    getDefaultDesktopPreferences,
    getDesktopPreferences,
    getLiveWindows,
    getStorageInfo,
    Menu,
    restoreListWindowPosition,
    setTray,
    showPrimaryWindowFromTray,
    state,
    updateTrayMenu,
    writeDesktopPreferences,
  } = deps;

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
      createLoginWindow: deps.createLoginWindow,
    });
  }

  function buildTrayMenuForApp(updateDesktopPreferences, quitDesktopApp) {
    return buildTrayMenu({
      Menu,
      getDesktopPreferences,
      updateDesktopPreferences,
      showPrimaryWindowFromTray: openPrimaryFromTray,
      logoutToLoginFromTray: () => deps.logoutToLoginFromTray({
        getLiveWindows,
        listWindow: () => state.getListWindow(),
        closeAllChatWindows: deps.closeAllChatWindows,
        createLoginWindow: deps.createLoginWindow,
      }),
      quitDesktopApp,
    });
  }

  function updateDesktopPreferences(patch = {}, quitDesktopApp) {
    const current = getDesktopPreferences();
    const next = { ...current, ...patch };
    if (!String(next.downloadsDir || "").trim()) next.downloadsDir = getDefaultDesktopPreferences().downloadsDir;
    writeDesktopPreferences(next);
    ensureStorageDirectories();
    applyLaunchOnStartupPreference();
    updateTrayMenu(buildTrayTooltip(state.unreadCount), () => buildTrayMenuForApp(updateDesktopPreferences, quitDesktopApp));
    return publishDesktopPreferences();
  }

  return {
    applyLaunchOnStartupPreference,
    buildTrayMenuForApp,
    openPrimaryFromTray,
    publishDesktopPreferences,
    updateDesktopPreferences,
  };
}

module.exports = {
  createDesktopAppPreferenceController,
};
