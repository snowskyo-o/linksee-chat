function createDesktopNotificationArgs(deps) {
  const {
    BrowserWindow,
    Notification,
    context,
    createChatWindow,
    createListWindow,
    desktopApp,
    focusWindow,
    fs,
    getDesktopPreferences,
    path,
    resolveTrayIconPath,
    shouldSuppressDesktopNotification,
    showDesktopNotification,
    slideOutListWindow,
    trayDeps,
  } = deps;

  return (payload) => showDesktopNotification({
    Notification,
    ...payload,
    getDesktopPreferences,
    resolveTrayIconPath: () => resolveTrayIconPath({ fs, path, process, projectRoot: context.projectRoot }),
    shouldSuppressDesktopNotification: (conversationId) => shouldSuppressDesktopNotification(BrowserWindow, context.windows.windowContextById, conversationId),
    createListWindow,
    createChatWindow,
    broadcastOpenConversation: (conversationId) => trayDeps.broadcastOpenConversation(conversationId, {
      listWindow: context.windows.listWindow,
      chatWindows: context.windows.chatWindows,
    }),
    slideOutListWindow,
    focusWindow,
    listWindow: () => context.windows.listWindow,
    showPrimaryWindowFromTray: desktopApp.openPrimaryFromTray,
  });
}

module.exports = {
  createDesktopNotificationArgs,
};
