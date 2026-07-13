function clearSessionStorageInWindow(window) {
  if (!window || window.isDestroyed()) return Promise.resolve();
  return window.webContents.executeJavaScript(`
    ["chat_access_token","chat_refresh_token","chat_user_id","chat_role"].forEach((key) => window.localStorage.removeItem(key));
  `, true).catch(() => {});
}

async function logoutToLoginFromTray({ getLiveWindows, listWindow, closeAllChatWindows, createLoginWindow }) {
  await Promise.all(getLiveWindows().map((window) => clearSessionStorageInWindow(window)));
  const currentListWindow = listWindow();
  if (currentListWindow && !currentListWindow.isDestroyed()) currentListWindow.destroy();
  closeAllChatWindows();
  createLoginWindow();
}

function buildTrayMenu({
  Menu,
  getDesktopPreferences,
  updateDesktopPreferences,
  showPrimaryWindowFromTray,
  logoutToLoginFromTray,
  quitDesktopApp,
}) {
  const preferences = getDesktopPreferences();
  return Menu.buildFromTemplate([
    { label: "打开主窗口", click: () => { showPrimaryWindowFromTray(); } },
    { label: preferences.notificationsMuted ? "关闭消息免打扰" : "消息免打扰", click: () => { updateDesktopPreferences({ notificationsMuted: !getDesktopPreferences().notificationsMuted }); } },
    { label: "退出登录", click: () => { logoutToLoginFromTray().catch(() => {}); } },
    { type: "separator" },
    { label: "退出程序", click: () => { quitDesktopApp(); } },
  ]);
}

function destroyTray(tray) {
  if (!tray) return null;
  tray.removeAllListeners();
  tray.destroy();
  return null;
}

function ensureTray({ existingTray, Tray, createTrayIcon, buildTrayTooltip, unreadCount, buildTrayMenu, showPrimaryWindowFromTray }) {
  if (existingTray && !existingTray.isDestroyed?.()) return existingTray;
  const tray = new Tray(createTrayIcon());
  tray.setToolTip(buildTrayTooltip(unreadCount));
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => { showPrimaryWindowFromTray(); });
  tray.on("click", () => { showPrimaryWindowFromTray(); });
  return tray;
}

module.exports = {
  buildTrayMenu,
  destroyTray,
  ensureTray,
  logoutToLoginFromTray,
};
