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

module.exports = {
  shouldSuppressDesktopNotification,
  showDesktopNotification,
};
