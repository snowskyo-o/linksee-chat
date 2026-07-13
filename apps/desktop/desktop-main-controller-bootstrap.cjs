const {
  createDesktopAppControllerArgs,
  createDesktopWindowControllerArgs,
} = require("./desktop-main-controller-bootstrap-args.cjs");

function createDesktopMainControllers(deps) {
  const {
    autoUpdater,
    context,
    createDesktopUpdateController,
    getDesktopPreferences,
    hideAllChatWindows,
    logoutToLoginFromTray,
    resolveTrayIconPath,
    setWindowContext,
    windowHelpers,
    writeDesktopPreferences,
    trayDeps,
  } = deps;

  const desktopAppRef = { current: null };
  const desktopWindows = deps.createDesktopWindowController(createDesktopWindowControllerArgs(deps, desktopAppRef));

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

  desktopAppRef.current = deps.createDesktopAppController(createDesktopAppControllerArgs(deps, desktopWindows, showPrimaryWindowFromTray));

  return {
    desktopApp: desktopAppRef.current,
    desktopUpdates,
    desktopWindows,
  };
}

module.exports = {
  createDesktopMainControllers,
};
