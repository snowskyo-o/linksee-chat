import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { appendAppLog } from "../../shared/app-log.js";
import { watchSystemAppearance } from "../../shared/appearance-mode.js";
import { subscribeAppSettings } from "../../shared/app-settings.js";
import { playNotificationSound } from "../../shared/notification-sound.js";
import { useChatDesktopControls } from "./useChatDesktopControls.js";
import { useChatMediaControls } from "./useChatMediaControls.js";

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
  const desktopControls = useChatDesktopControls({ store, actions });
  const mediaControls = useChatMediaControls({
    store,
    actions,
    stickerLibrary,
    appInfo: desktopControls.appInfo,
  });
  const hadRealtimeConnected = ref(false);
  const networkBannerText = ref("");
  const showStandaloneInfoSidebar = computed(() => (
    standaloneConversationMode.value && Boolean(store.selectedConversation.value)
  ));
  const unreadTotal = computed(() => store.conversations.value.reduce((sum, row) => {
    return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
  }, 0));
  let conversationsRefreshTimer = null;
  let selectedRefreshTimer = null;
  let detachUpdateState = null;
  let detachDesktopPreferences = null;
  let detachOpenConversation = null;
  let detachAppSettings = null;
  let detachSystemAppearance = null;
  let draftPersistTimer = null;

  function isCurrentConversationFocused(conversationId) {
    return document.visibilityState === "visible"
      && document.hasFocus()
      && String(store.selectedId.value) === String(conversationId);
  }

  function syncReadStateIfFocused() {
    if (!isCurrentConversationFocused(store.selectedId.value)) return Promise.resolve();
    return actions.markConversationReadIfNeeded?.().catch(() => {});
  }

  function syncDesktopWindowContext() {
    if (typeof window.desktopShell?.updateWindowContext !== "function") return;
    window.desktopShell.updateWindowContext({
      kind: standaloneConversationMode.value ? "chat" : "main-chat",
      conversationId: String(store.selectedId.value || ""),
    }).catch(() => {});
  }

  async function notifyIncomingMessage(conversationId) {
    if (!conversationId || desktopControls.desktopPreferences.value.notificationsMuted || !desktopControls.appSettings.value.notifications?.desktopEnabled && !desktopControls.appSettings.value.notifications?.soundEnabled) return;
    if (isCurrentConversationFocused(conversationId)) return;
    const conversation = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    const title = conversation?.title || conversation?.displayTitle || store.chatTitle.value || "新消息";
    const body = conversation?.lastMessage?.content || "你收到一条新消息";

    if (desktopControls.appSettings.value.notifications?.soundEnabled) {
      const played = await playNotificationSound().catch(() => false);
      if (!played) window.desktopShell?.beep?.();
    }
    if (desktopControls.appSettings.value.notifications?.desktopEnabled) {
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

  onMounted(async () => {
    try {
      desktopControls.syncAppearance();
      window.addEventListener("focus", syncReadStateIfFocused);
      document.addEventListener("visibilitychange", syncReadStateIfFocused);
      detachAppSettings = subscribeAppSettings((nextSettings) => {
        desktopControls.appSettings.value = nextSettings;
        desktopControls.syncAppearance();
      });
      detachSystemAppearance = watchSystemAppearance(() => {
        if ((desktopControls.appSettings.value.appearance?.themeMode || "system") === "system") desktopControls.syncAppearance();
      });
      const runtimeInfo = await window.desktopShell?.getAppInfo?.().catch(() => null);
      if (runtimeInfo) {
        desktopControls.appInfo.value = {
          productName: runtimeInfo.productName || "Linksee Chat",
          version: runtimeInfo.version || "",
          electron: runtimeInfo.electron || desktopControls.appInfo.value.electron,
          chrome: runtimeInfo.chrome || desktopControls.appInfo.value.chrome,
          node: runtimeInfo.node || desktopControls.appInfo.value.node,
          storage: runtimeInfo.storage || null,
        };
        desktopControls.applyDesktopPreferenceState(runtimeInfo);
      }
      if (typeof window.desktopShell?.onUpdateState === "function") {
        detachUpdateState = window.desktopShell.onUpdateState((state) => desktopControls.applyDesktopUpdateState(state));
      }
      if (typeof window.desktopShell?.onDesktopPreferences === "function") {
        detachDesktopPreferences = window.desktopShell.onDesktopPreferences((payload) => desktopControls.applyDesktopPreferenceState(payload));
      }
      if (typeof window.desktopShell?.onOpenConversation === "function") {
        detachOpenConversation = window.desktopShell.onOpenConversation((payload) => {
          handleDesktopOpenConversation(payload).catch(() => {});
        });
      }
      await actions.loadProfile(auth);
      await actions.loadContacts().catch(() => {});
      await reloadConversationList();
      await stickerLibrary.refresh();
      if (standaloneConversationMode.value && desktopConversationId) {
        await actions.selectConversation(desktopConversationId).catch(() => {});
      } else {
        await reloadSelectedConversation();
        if (store.selectedId.value) {
          const draft = await actions.loadConversationDraft(store.selectedId.value);
          store.messageInput.value = draft.text || "";
          store.pendingFiles.value = Array.isArray(draft.files) ? draft.files : [];
          store.updateMentionState(store.messageInput.value);
        }
      }
      syncDesktopWindowContext();
      realtime.connect();
      desktopControls.checkForUpdates().catch(() => {});
    } catch (error) {
      store.setComposerHint(error?.message || "聊天初始化失败", "error");
    }
  });

  onBeforeUnmount(() => {
    window.removeEventListener("focus", syncReadStateIfFocused);
    document.removeEventListener("visibilitychange", syncReadStateIfFocused);
    if (conversationsRefreshTimer) window.clearTimeout(conversationsRefreshTimer);
    if (selectedRefreshTimer) window.clearTimeout(selectedRefreshTimer);
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (typeof detachUpdateState === "function") detachUpdateState();
    if (typeof detachDesktopPreferences === "function") detachDesktopPreferences();
    if (typeof detachOpenConversation === "function") detachOpenConversation();
    if (typeof detachAppSettings === "function") detachAppSettings();
    if (typeof detachSystemAppearance === "function") detachSystemAppearance();
    if (store.selectedId.value) {
      actions.saveConversationDraft(store.selectedId.value, store.messageInput.value, store.pendingFiles.value).catch(() => {});
    }
    realtime.disconnect();
  });

  watch(() => store.selectedId.value, () => {
    syncDesktopWindowContext();
  });

  watch(() => store.socketOnline.value, (online, previousOnline) => {
    if (online) {
      hadRealtimeConnected.value = true;
      networkBannerText.value = "";
      return;
    }
    if (previousOnline && hadRealtimeConnected.value) {
      networkBannerText.value = "网络已断开，正在重新连接……";
    }
  });

  watch(unreadTotal, (value) => {
    window.desktopShell?.updateUnreadCount?.(value).catch?.(() => {});
  }, { immediate: true });

  watch(() => [store.selectedId.value, store.messageInput.value], ([conversationId, messageInput]) => {
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (!conversationId) return;
    draftPersistTimer = window.setTimeout(() => {
      actions.saveConversationDraft(conversationId, messageInput, store.pendingFiles.value).catch(() => {});
      draftPersistTimer = null;
    }, 240);
  });

  watch(() => [store.selectedId.value, store.pendingFiles.value.map((item) => `${item.name}:${item.size}:${item.lastModified}`).join("|")], ([conversationId]) => {
    if (draftPersistTimer) window.clearTimeout(draftPersistTimer);
    if (!conversationId) return;
    draftPersistTimer = window.setTimeout(() => {
      actions.saveConversationDraft(conversationId, store.messageInput.value, store.pendingFiles.value).catch(() => {});
      draftPersistTimer = null;
    }, 240);
  });

  watch(() => [desktopControls.appSettings.value.files?.autoReceiveImages, store.renderedMessages.value.map((message) => message.id).join("|")], ([enabled]) => {
    if (!enabled || !window.desktopShell?.isDesktop) return;
    const imageFiles = store.renderedMessages.value.flatMap((message) => message.files || []).filter((file) => file?.isImage);
    actions.autoReceiveImages?.(imageFiles).catch?.(() => {});
  }, { immediate: true });

  return {
    handleRealtimeEvent,
    networkBannerText,
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
