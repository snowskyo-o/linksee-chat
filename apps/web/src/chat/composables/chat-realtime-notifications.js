import { appendAppLog } from "../../shared/app-log.js";
import { playNotificationSound } from "../../shared/notification-sound.js";
import { buildDerivedConversationPreview } from "../store/chat-store-derived-utils.js";

export function createRealtimeFocusHelpers(store) {
  function isCurrentConversationFocused(conversationId) {
    return document.visibilityState === "visible"
      && document.hasFocus()
      && String(store.selectedId.value) === String(conversationId);
  }

  function syncReadStateIfFocused(actions) {
    if (!isCurrentConversationFocused(store.selectedId.value)) return Promise.resolve();
    return actions.markConversationReadIfNeeded?.().catch(() => {});
  }

  return { isCurrentConversationFocused, syncReadStateIfFocused };
}

export function createRealtimeNotificationActions({ store, desktopControls, isCurrentConversationFocused }) {
  return {
    async notifyIncomingMessage(conversationId) {
      const notificationsMuted = desktopControls.desktopPreferences.value.notificationsMuted;
      const desktopEnabled = desktopControls.appSettings.value.notifications?.desktopEnabled;
      const soundEnabled = desktopControls.appSettings.value.notifications?.soundEnabled;
      if (!conversationId || notificationsMuted || (!desktopEnabled && !soundEnabled)) return;
      if (isCurrentConversationFocused(conversationId)) return;
      const conversation = store.conversations.value.find((item) => String(item.id) === String(conversationId));
      const title = conversation?.title || conversation?.displayTitle || store.chatTitle.value || "新消息";
      const body = conversation?.lastMessage ? buildDerivedConversationPreview(conversation, store.me.value?.id || "") : "你收到一条新消息";

      if (soundEnabled) {
        const played = await playNotificationSound().catch(() => false);
        if (!played) window.desktopShell?.beep?.();
      }
      if (desktopEnabled) {
        if (typeof window.desktopShell?.showNotification === "function") {
          await window.desktopShell.showNotification({ title, body, conversationId }).catch(() => {});
          appendAppLog({ level: "info", category: "notification", message: `已发送桌面提醒：${title}`, meta: body });
          return;
        }
        if ("Notification" in window) {
          if (Notification.permission === "default") await Notification.requestPermission().catch(() => "denied");
          if (Notification.permission === "granted") {
            new Notification(title, { body });
            appendAppLog({ level: "info", category: "notification", message: `已发送浏览器提醒：${title}`, meta: body });
          }
        }
      }
    },
  };
}
