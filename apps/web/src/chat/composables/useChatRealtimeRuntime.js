import { computed, ref } from "vue";
import { createRealtimeNotificationActions, createRealtimeFocusHelpers } from "./chat-realtime-notifications.js";
import { createRealtimeRefreshScheduler } from "./chat-realtime-refresh.js";

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
  const { isCurrentConversationFocused, syncReadStateIfFocused } = createRealtimeFocusHelpers(store);
  const { notifyIncomingMessage } = createRealtimeNotificationActions({
    store,
    desktopControls,
    isCurrentConversationFocused,
  });
  const {
    clearRealtimeTimers,
    scheduleConversationsRefresh,
    scheduleSelectedRefresh,
  } = createRealtimeRefreshScheduler({ actions, syncReadStateIfFocused });

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
