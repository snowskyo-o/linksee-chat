const { buildTrayTooltip, createTrayIcon, resolveTrayIconPath } = require("./desktop-tray-icon.cjs");
const { buildTrayMenu, destroyTray, ensureTray, logoutToLoginFromTray } = require("./desktop-tray-menu.cjs");
const { shouldSuppressDesktopNotification, showDesktopNotification } = require("./desktop-tray-notifications.cjs");
const { broadcastOpenConversation, hideAllChatWindows, showPrimaryWindowFromTray } = require("./desktop-tray-window-actions.cjs");

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
  shouldSuppressDesktopNotification,
  showDesktopNotification,
  showPrimaryWindowFromTray,
};
