import { appendAppLog } from "../../shared/app-log.js";
import { playNotificationSound } from "../../shared/notification-sound.js";
import { buildDerivedConversationPreview, buildDerivedConversationTitle } from "../store/chat-store-derived-utils.js";

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

export function resolveIncomingNotificationCopy(conversation, currentUserId) {
  if (!conversation) return { title: "新消息", body: "你收到一条新消息" };
  return {
    title: buildDerivedConversationTitle(conversation, currentUserId) || "新消息",
    body: conversation.lastMessage ? buildDerivedConversationPreview(conversation, currentUserId) : "你收到一条新消息",
  };
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
      const { title, body } = resolveIncomingNotificationCopy(conversation, store.me.value?.id || "");

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
