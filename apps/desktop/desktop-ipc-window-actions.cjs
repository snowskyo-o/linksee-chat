function registerDesktopWindowActionIpc(ipcMain, deps) {
  const {
    buildTrayMenu,
    buildTrayTooltip,
    createChatWindow,
    createListWindow,
    logout,
    resolveWindowByEvent,
    setUnreadCount,
    shell,
    showDesktopNotification,
    slideOutListWindow,
    toggleWindowMaximize,
    trayRef,
    windowStateBuilder,
  } = deps;

  ipcMain.handle("desktop:get-window-state", (event) => windowStateBuilder(resolveWindowByEvent(event)));
  ipcMain.handle("desktop:update-window-context", (event, payload = {}) => {
    const currentWindow = resolveWindowByEvent(event);
    deps.registerWindowContext(currentWindow, payload || {});
    return true;
  });
  ipcMain.handle("desktop:minimize", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    window.minimize();
    return windowStateBuilder(window);
  });
  ipcMain.handle("desktop:toggle-maximize", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    toggleWindowMaximize(window);
    return windowStateBuilder(window);
  });
  ipcMain.handle("desktop:close", (event) => {
    const window = resolveWindowByEvent(event);
    if (!window || window.isDestroyed()) return null;
    window.close();
    return null;
  });
  ipcMain.handle("desktop:login-success", (event) => {
    createListWindow();
    const window = resolveWindowByEvent(event);
    if (window && !window.isDestroyed()) window.close();
    return true;
  });
  ipcMain.handle("desktop:open-chat-window", (_event, conversationId) => {
    createChatWindow(conversationId);
    slideOutListWindow();
    return true;
  });
  ipcMain.handle("desktop:logout", () => {
    logout();
    return true;
  });
  ipcMain.handle("desktop:show-notification", (_event, payload) => showDesktopNotification(payload || {}));
  ipcMain.handle("desktop:beep", () => {
    shell.beep();
    return true;
  });
  ipcMain.handle("desktop:update-unread-count", (_event, nextCount) => {
    const unreadCount = setUnreadCount(nextCount);
    const tray = trayRef();
    if (tray && !tray.isDestroyed?.()) {
      tray.setToolTip(buildTrayTooltip(unreadCount));
      tray.setContextMenu(buildTrayMenu());
    }
    return unreadCount;
  });
}

module.exports = {
  registerDesktopWindowActionIpc,
};
