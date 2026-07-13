import { computed } from "vue";
import { useChatDesktopControls } from "./useChatDesktopControls.js";
import { useChatMediaControls } from "./useChatMediaControls.js";
import { useChatPageLifecycle } from "./useChatPageLifecycle.js";
import { useChatRealtimeRuntime } from "./useChatRealtimeRuntime.js";
import { formatChatTitle } from "./chat-title-format.js";

export function useChatPageRuntime({
  auth,
  store,
  actions,
  realtime,
  stickerLibrary,
  desktopConversationId,
  standaloneConversationMode,
  selectConversation,
}) {
  function resolveDesktopWindowTitle() {
    return formatChatTitle(
      store.chatTitle.value,
      store.selectedConversation.value?.kind || "",
      store.selectedConversation.value?.participantIds?.length || store.participants.value.length,
    ) || "Linksee Chat";
  }

  const desktopControls = useChatDesktopControls({ store, actions });
  const mediaControls = useChatMediaControls({
    store,
    actions,
    stickerLibrary,
    appInfo: desktopControls.appInfo,
  });
  const showStandaloneInfoSidebar = computed(() => (
    standaloneConversationMode.value && Boolean(store.selectedConversation.value)
  ));
  const realtimeRuntime = useChatRealtimeRuntime({
    store,
    actions,
    desktopControls,
    standaloneConversationMode,
    selectConversation,
  });

  function syncDesktopWindowContext() {
    if (typeof window.desktopShell?.updateWindowContext !== "function") return;
    window.desktopShell.updateWindowContext({
      kind: standaloneConversationMode.value ? "chat" : "main-chat",
      conversationId: String(store.selectedId.value || ""),
      title: resolveDesktopWindowTitle(),
    }).catch(() => {});
  }

  async function reloadConversationList() {
    await actions.loadConversations().catch((error) => {
      store.pushNotification({ title: "加载失败", message: error?.message || "暂时无法获取会话列表", tone: "error" });
    });
  }

  async function reloadSelectedConversation() {
    if (!store.selectedId.value) return;
    await actions.refreshSelectedConversation().catch((error) => {
      store.setComposerHint(error?.message || "暂时无法获取聊天内容", "error");
    });
  }
  useChatPageLifecycle({
    auth,
    store,
    actions,
    realtime,
    stickerLibrary,
    desktopConversationId,
    standaloneConversationMode,
    desktopControls,
    mediaControls,
    realtimeRuntime,
    syncDesktopWindowContext,
    reloadConversationList,
    reloadSelectedConversation,
  });

  return {
    handleRealtimeEvent: realtimeRuntime.handleRealtimeEvent,
    networkBannerText: realtimeRuntime.networkBannerText,
    reloadConversationList,
    reloadSelectedConversation,
    showStandaloneInfoSidebar,
    ...desktopControls,
    ...mediaControls,
    handleComposerKeydown(event) {
      return mediaControls.handleComposerKeydown(event, desktopControls.appSettings);
    },
  };
}
