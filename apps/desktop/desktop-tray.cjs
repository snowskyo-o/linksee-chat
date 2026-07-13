function createFallbackTrayIcon(nativeImage) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect x="6" y="6" width="52" height="52" rx="16" fill="#4f7cff"/>
      <path d="M22 18h8v28h16v8H22V18z" fill="#ffffff"/>
    </svg>
  `.trim();
  return nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).resize({ width: 16, height: 16 });
}

function resolveTrayIconPath({ fs, path, process, projectRoot }) {
  const candidates = process.platform === "win32"
    ? [
        path.join(process.resourcesPath || "", "icon.ico"),
        path.join(path.dirname(process.execPath), "resources", "icon.ico"),
        path.join(projectRoot, "build", "icon.ico"),
      ]
    : [
        path.join(process.resourcesPath || "", "icon.png"),
        path.join(path.dirname(process.execPath), "resources", "icon.png"),
        path.join(projectRoot, "build", "icon.png"),
      ];

  return candidates.find((file) => file && fs.existsSync(file)) || "";
}

function createTrayIcon({ nativeImage, resolveTrayIconPath }) {
  const trayIconPath = resolveTrayIconPath();
  if (trayIconPath) {
    const icon = nativeImage.createFromPath(trayIconPath);
    if (!icon.isEmpty()) return icon.resize({ width: 16, height: 16 });
  }
  return createFallbackTrayIcon(nativeImage);
}

function buildTrayTooltip(unreadCount) {
  return unreadCount <= 0 ? "Linksee Chat" : `Linksee Chat（${unreadCount > 99 ? "99+" : unreadCount} 条未读）`;
}

function destroyTray(tray) {
  if (!tray) return null;
  tray.removeAllListeners();
  tray.destroy();
  return null;
}

function hideAllChatWindows(chatWindows) {
  for (const window of chatWindows.values()) {
    if (window && !window.isDestroyed()) window.hide();
  }
}

function showPrimaryWindowFromTray({ listWindow, loginWindow, restoreListWindowPosition, focusWindow, createLoginWindow }) {
  if (listWindow && !listWindow.isDestroyed()) {
    restoreListWindowPosition();
    focusWindow(listWindow);
    return;
  }
  if (loginWindow && !loginWindow.isDestroyed()) {
    focusWindow(loginWindow);
    return;
  }
  createLoginWindow();
}

function sendConversationToWindow(window, conversationId) {
  if (!window || window.isDestroyed()) return;
  const payload = { conversationId: String(conversationId || "").trim() };
  if (!payload.conversationId) return;
  const emit = () => window.webContents.send("desktop:open-conversation", payload);
  if (window.webContents.isLoadingMainFrame()) return void window.webContents.once("did-finish-load", emit);
  emit();
}

function broadcastOpenConversation(conversationId, { listWindow, chatWindows }) {
  const targetId = String(conversationId || "").trim();
  if (!targetId) return;
  sendConversationToWindow(listWindow, targetId);
  for (const window of chatWindows.values()) {
    sendConversationToWindow(window, targetId);
  }
}

function shouldSuppressDesktopNotification(conversationId, { BrowserWindow, windowContextById }) {
  const targetConversationId = String(conversationId || "").trim();
  if (!targetConversationId) return false;
  for (const [windowId, context] of windowContextById.entries()) {
    const currentWindow = BrowserWindow.fromId(windowId);
    if (!currentWindow || currentWindow.isDestroyed() || currentWindow.isMinimized() || !currentWindow.isVisible()) continue;
    if (!currentWindow.isFocused()) continue;
    if (String(context?.conversationId || "").trim() === targetConversationId) return true;
  }
  return false;
}

function showDesktopNotification({
  Notification,
  conversationId = "",
  title,
  body,
  getDesktopPreferences,
  resolveTrayIconPath,
  shouldSuppressDesktopNotification,
  createListWindow,
  createChatWindow,
  broadcastOpenConversation,
  slideOutListWindow,
  focusWindow,
  listWindow,
  showPrimaryWindowFromTray,
}) {
  if (getDesktopPreferences().notificationsMuted) return false;
  if (shouldSuppressDesktopNotification(conversationId)) return false;
  if (!Notification.isSupported()) return false;
  const notification = new Notification({
    title: String(title || "Linksee Chat"),
    body: String(body || "你收到一条新消息"),
    silent: true,
    icon: resolveTrayIconPath() || undefined,
  });
  notification.on("click", () => {
    if (conversationId) {
      createListWindow();
      const chatWindow = createChatWindow(conversationId);
      broadcastOpenConversation(conversationId);
      slideOutListWindow();
      focusWindow(chatWindow || listWindow());
      return;
    }
    showPrimaryWindowFromTray();
  });
  notification.show();
  return true;
}

function clearSessionStorageInWindow(window) {
  if (!window || window.isDestroyed()) return Promise.resolve();
  return window.webContents.executeJavaScript(`
    ["chat_access_token","chat_refresh_token","chat_user_id","chat_role"].forEach((key) => window.localStorage.removeItem(key));
  `, true).catch(() => {});
}

async function logoutToLoginFromTray({ getLiveWindows, listWindow, closeAllChatWindows, createLoginWindow }) {
  await Promise.all(getLiveWindows().map((window) => clearSessionStorageInWindow(window)));
  const currentListWindow = listWindow();
  if (currentListWindow && !currentListWindow.isDestroyed()) {
    currentListWindow.destroy();
  }
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

function ensureTray({ existingTray, Tray, createTrayIcon, buildTrayTooltip, unreadCount, buildTrayMenu, showPrimaryWindowFromTray }) {
  if (existingTray && !existingTray.isDestroyed?.()) return existingTray;
  const tray = new Tray(createTrayIcon());
  tray.setToolTip(buildTrayTooltip(unreadCount));
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => {
    showPrimaryWindowFromTray();
  });
  tray.on("click", () => {
    showPrimaryWindowFromTray();
  });
  return tray;
}

module.exports = {
  broadcastOpenConversation,
  buildTrayMenu,
  buildTrayTooltip,
  createTrayIcon,
  destroyTray,
  ensureTray,
  hideAllChatWindows,
  logoutToLoginFromTray,
  resolveTrayIconPath,
  showDesktopNotification,
  showPrimaryWindowFromTray,
};
