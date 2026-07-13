const { createDesktopAppPreferenceController } = require("./desktop-app-controller-preferences.cjs");
const { createDesktopAppSessionController } = require("./desktop-app-controller-session.cjs");

function createDesktopAppController(deps) {
  const preferenceController = createDesktopAppPreferenceController(deps);
  const sessionController = createDesktopAppSessionController(deps);

  function setUnreadCount(nextCount) {
    deps.state.unreadCount = Math.max(0, Number(nextCount || 0));
    return deps.state.unreadCount;
  }

  function handleReady() {
    deps.getDesktopPreferences();
    preferenceController.applyLaunchOnStartupPreference();
    deps.ensureStorageDirectories();
    deps.setTray(deps.ensureTray({
      existingTray: deps.state.getTray(),
      Tray: deps.Tray,
      createTrayIcon: deps.createTrayIcon,
      buildTrayTooltip: deps.buildTrayTooltip,
      unreadCount: deps.state.unreadCount,
      buildTrayMenu: () => preferenceController.buildTrayMenuForApp(updateDesktopPreferences, sessionController.quitDesktopApp),
      showPrimaryWindowFromTray: preferenceController.openPrimaryFromTray,
    }));
    deps.createLoginWindow();
  }

  function updateDesktopPreferences(patch = {}) {
    return preferenceController.updateDesktopPreferences(patch, sessionController.quitDesktopApp);
  }

  return {
    applyLaunchOnStartupPreference: preferenceController.applyLaunchOnStartupPreference,
    buildTrayMenuForApp: () => preferenceController.buildTrayMenuForApp(updateDesktopPreferences, sessionController.quitDesktopApp),
    handleBeforeQuit: sessionController.handleBeforeQuit,
    handleReady,
    handleWillQuit: sessionController.handleWillQuit,
    logout: sessionController.logout,
    markAppQuitting: sessionController.markAppQuitting,
    openPrimaryFromTray: preferenceController.openPrimaryFromTray,
    publishDesktopPreferences: preferenceController.publishDesktopPreferences,
    quitDesktopApp: sessionController.quitDesktopApp,
    setUnreadCount,
    updateDesktopPreferences,
  };
}

module.exports = {
  createDesktopAppController,
};
