const { createDesktopMainControllers } = require("./desktop-main-controller-bootstrap.cjs");
const { registerDesktopMainIpc } = require("./desktop-main-ipc-bootstrap.cjs");

function bootstrapDesktopMain(deps) {
  const { app, autoUpdater, context } = deps;
  const { desktopApp, desktopUpdates, desktopWindows } = createDesktopMainControllers(deps);
  registerDesktopMainIpc({
    ...deps,
    app,
    autoUpdater,
    context,
    createChatWindow: desktopWindows.createChatWindow,
    createListWindow: desktopWindows.createListWindow,
    createLoginWindow: desktopWindows.createLoginWindow,
    desktopApp,
    desktopUpdates,
    slideOutListWindow: desktopWindows.slideOutListWindow,
  });
  desktopUpdates.registerAutoUpdaterEvents();
  return { desktopApp };
}

module.exports = {
  bootstrapDesktopMain,
};
