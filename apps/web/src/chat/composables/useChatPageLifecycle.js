import { onBeforeUnmount, onMounted } from "vue";
import { createChatPageLifecycleBindings } from "./chat-page-lifecycle-bindings.js";
import { useChatPageLifecycleWatchers } from "./chat-page-lifecycle-watchers.js";

export function useChatPageLifecycle({
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
}) {
  const lifecycleBindings = createChatPageLifecycleBindings({
    actions,
    auth,
    desktopControls,
    desktopConversationId,
    realtime,
    realtimeRuntime,
    reloadConversationList,
    reloadSelectedConversation,
    standaloneConversationMode,
    stickerLibrary,
    store,
    syncDesktopWindowContext,
  });
  const lifecycleWatchers = useChatPageLifecycleWatchers({
    actions,
    desktopControls,
    realtimeRuntime,
    store,
    syncDesktopWindowContext,
  });

  onMounted(async () => {
    try {
      await lifecycleBindings.mountLifecycle();
    } catch (error) {
      store.setComposerHint(error?.message || "聊天初始化失败", "error");
    }
  });

  onBeforeUnmount(() => {
    lifecycleWatchers.clearDraftPersistTimer();
    lifecycleBindings.unmountLifecycle();
  });

  return {
    mediaControls,
  };
}
