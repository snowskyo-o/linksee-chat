import { computed, ref } from "vue";
import { appendAppLog } from "../../shared/app-log.js";
import { playNotificationSound } from "../../shared/notification-sound.js";

export function useChatRealtimeRuntime({
  store,
  actions,
  desktopControls,
  standaloneConversationMode,
  selectConversation,
}) {
  const hadRealtimeConnected = ref(false);
  const networkBannerText = ref("");
  const unreadTotal = computed(() => store.conversations.value.reduce((sum, row) => {
    return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
  }, 0));
  let conversationsRefreshTimer = null;
  let selectedRefreshTimer = null;

  function isCurrentConversationFocused(conversationId) {
    return document.visibilityState === "visible"
      && document.hasFocus()
      && String(store.selectedId.value) === String(conversationId);
  }

  function syncReadStateIfFocused() {
    if (!isCurrentConversationFocused(store.selectedId.value)) return Promise.resolve();
    return actions.markConversationReadIfNeeded?.().catch(() => {});
  }

  async function notifyIncomingMessage(conversationId) {
    const notificationsMuted = desktopControls.desktopPreferences.value.notificationsMuted;
    const desktopEnabled = desktopControls.appSettings.value.notifications?.desktopEnabled;
    const soundEnabled = desktopControls.appSettings.value.notifications?.soundEnabled;
    if (!conversationId || notificationsMuted || (!desktopEnabled && !soundEnabled)) return;
    if (isCurrentConversationFocused(conversationId)) return;
    const conversation = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    const title = conversation?.title || conversation?.displayTitle || store.chatTitle.value || "新消息";
    const body = conversation?.lastMessage?.content || "你收到一条新消息";

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
  }

  function scheduleConversationsRefresh() {
    if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
    conversationsRefreshTimer = window.setTimeout(() => {
      actions.loadConversations().catch(() => {});
      conversationsRefreshTimer = null;
    }, 120);
  }

  function scheduleSelectedRefresh() {
    if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
    selectedRefreshTimer = window.setTimeout(() => {
      actions.refreshSelectedConversation().then(() => syncReadStateIfFocused()).catch(() => {});
      selectedRefreshTimer = null;
    }, 120);
  }

  async function handleRealtimeEvent(event) {
    const topic = String(event?.topic || "");
    const conversationId = String(event?.payload?.conversationId || "");
    if (!topic || topic === "socket.ready") return;
    if (topic === "user.profile.dirty") {
      actions.markProfileDirty(event.payload?.userId);
      return;
    }
    if (topic === "conversation.message.created") notifyIncomingMessage(conversationId);
    scheduleConversationsRefresh();
    if (conversationId && String(store.selectedId.value) === conversationId) scheduleSelectedRefresh();
  }

  async function handleDesktopOpenConversation(payload = {}) {
    if (standaloneConversationMode.value) return;
    const conversationId = String(payload.conversationId || "").trim();
    if (!conversationId || conversationId === String(store.selectedId.value || "")) return;
    await selectConversation(conversationId);
  }

  function handleSocketOnlineChange(online, previousOnline) {
    if (online) {
      hadRealtimeConnected.value = true;
      networkBannerText.value = "";
      return;
    }
    if (previousOnline && hadRealtimeConnected.value) {
      networkBannerText.value = "网络已断开，正在重新连接……";
    }
  }

  function clearRealtimeTimers() {
    if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
    if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
  }

  return {
    clearRealtimeTimers,
    handleDesktopOpenConversation,
    handleRealtimeEvent,
    handleSocketOnlineChange,
    networkBannerText,
    syncReadStateIfFocused,
    unreadTotal,
  };
}
