const {
  createDesktopIpcHandlerArgs,
} = require("./desktop-main-ipc-bootstrap-args.cjs");
const {
  createDesktopNotificationArgs,
} = require("./desktop-main-ipc-notification-args.cjs");

function registerDesktopMainIpc(deps) {
  const ipcArgs = createDesktopIpcHandlerArgs(deps);
  ipcArgs.markAppQuitting = deps.desktopApp.markAppQuitting;
  ipcArgs.showDesktopNotification = createDesktopNotificationArgs(deps);
  deps.registerDesktopIpcHandlers(ipcArgs);
}

module.exports = {
  registerDesktopMainIpc,
};
