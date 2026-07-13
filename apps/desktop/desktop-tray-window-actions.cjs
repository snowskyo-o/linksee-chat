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

module.exports = {
  broadcastOpenConversation,
  hideAllChatWindows,
  showPrimaryWindowFromTray,
};
