import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { watchSystemAppearance } from "../../shared/appearance-mode.js";
import { chatApi } from "../../shared/api-client.js";
import { subscribeAppSettings } from "../../shared/app-settings.js";
import { formatConversationTime, useRecentKeywords } from "./useRecentKeywords.js";
import { useConversationSearchSections } from "./useConversationSearchSections.js";
import { useListSearch } from "./useListSearch.js";
import { useChatDesktopControls } from "./useChatDesktopControls.js";

export function useConversationListRuntime({
  auth,
  store,
  actions,
  realtime,
  shell,
  friendCenter,
  selectConversation,
}) {
  const desktopControls = useChatDesktopControls({ store, actions });
  const searchFocused = ref(false);
  const quickCreateOpen = ref(false);
  const activePane = ref("messages");
  const remarkDialogOpen = ref(false);
  const remarkDraft = ref("");
  const remarkTarget = ref(null);
  const { recentKeywords, pushRecentKeyword, clearRecentKeywords } = useRecentKeywords();

  const unreadTotal = computed(() => store.filteredConversations.value.reduce((sum, row) => {
    return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
  }, 0));
  const filteredFavorites = computed(() => {
    const keyword = store.conversationKeyword.value.trim().toLowerCase();
    return store.favoriteMessages.value.filter((item) => {
      if (!keyword) return true;
      return [item.conversationTitle, item.senderName, item.content]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  });
  const searchKeyword = computed(() => store.conversationKeyword.value.trim());
  const contactRows = computed(() => store.createDialogContacts.value.map((contact) => ({
    key: `contact:${contact.id}`,
    id: contact.id,
    title: contact.name,
    subtitle: contact.friendAlias && contact.realName && contact.realName !== contact.friendAlias
      ? `${contact.realName}${contact.bio ? ` · ${contact.bio}` : ""}`
      : (contact.bio || "联系人"),
    meta: "联系人",
    kind: "contact",
    avatarUrl: contact.avatarUrl,
    avatarText: contact.name.slice(0, 2).toUpperCase(),
  })));
  const filteredContacts = computed(() => {
    const keyword = searchKeyword.value.toLowerCase();
    if (!keyword) return contactRows.value;
    return contactRows.value.filter((row) => (
      [row.title, row.subtitle].some((value) => String(value || "").toLowerCase().includes(keyword))
    ));
  });
  const searchPanelOpen = computed(() => searchFocused.value || Boolean(searchKeyword.value));
  const visibleConversations = computed(() => (
    searchPanelOpen.value ? store.conversationRows.value : store.filteredConversations.value
  ));
  const searchSections = useConversationSearchSections(store, searchKeyword, contactRows);
  const searchController = useListSearch({
    openRef: searchPanelOpen,
    keywordRef: searchKeyword,
    recentKeywordsRef: recentKeywords,
    sectionsRef: searchSections,
    onPick: (item) => handleSearchPick(item),
    onRecentPick: (value) => applyRecentKeyword(value),
    onFooterPick: () => handleSearchFooterPick(),
  });

  let detachUpdateState = null;
  let detachDesktopPreferences = null;
  let detachOpenConversation = null;
  let detachAppSettings = null;
  let detachSystemAppearance = null;
  let friendSearchTimer = 0;

  async function handleRealtimeEvent(event) {
    const topic = String(event?.topic || "");
    if (!topic || topic === "socket.ready") return;
    if (topic === "user.profile.dirty") {
      actions.markProfileDirty(event.payload?.userId);
      return;
    }
    if (topic.startsWith("conversation.")) {
      actions.loadConversations().catch(() => {});
    }
  }

  async function openConversation(id) {
    store.showConversation(id);
    store.selectedId.value = id;
    const conversation = store.conversations.value.find((item) => String(item.id) === String(id));
    await actions.refreshProfilesIfDirty((conversation?.participants || []).map((user) => user.id)).catch(() => {});
    if (typeof window.desktopShell?.openChatWindow === "function") await window.desktopShell.openChatWindow(id);
  }

  async function reloadConversationList() {
    await actions.loadConversations().catch((error) => {
      store.pushNotification({ title: "加载失败", message: error?.message || "暂时无法获取会话列表", tone: "error" });
    });
  }

  async function handleDesktopOpenConversation(payload = {}) {
    const conversationId = String(payload.conversationId || "").trim();
    if (!conversationId) return;
    activePane.value = "messages";
    await actions.loadConversations().catch(() => {});
    store.showConversation(conversationId);
    store.selectedId.value = conversationId;
  }

  async function openFavorite(item) {
    if (!item?.conversationId) return;
    activePane.value = "messages";
    await openConversation(item.conversationId);
  }

  const removeFavorite = (item) => store.removeFavoriteMessage(item?.id);
  const copyConversationTitle = async (row) => {
    const title = String(row?.displayTitle || row?.title || "").trim();
    if (!title) return;
    try {
      await navigator.clipboard.writeText(title);
      store.pushNotification({ title: "已复制", message: `“${title}”`, tone: "success", ttl: 1600 });
    } catch (error) {
      store.pushNotification({ title: "复制失败", message: error?.message || "当前环境不支持剪贴板", tone: "error" });
    }
  };
  const toggleConversationMute = (row) => {
    const muted = store.toggleConversationMuted(row?.id);
    store.pushNotification({ title: muted ? "已开启免打扰" : "已取消免打扰", message: row?.displayTitle || "会话", tone: "success", ttl: 1600 });
  };
  const markConversationRead = (row) => {
    actions.markConversationReadById(row?.id).then(() => {
      store.pushNotification({ title: "已标记已读", message: row?.displayTitle || "会话", tone: "success", ttl: 1400 });
    }).catch((error) => {
      store.pushNotification({ title: "操作失败", message: error?.message || "暂时无法标记已读", tone: "error" });
    });
  };
  const hideConversationFromList = (row) => {
    if (!row?.id) return;
    chatApi.delete(`/api/v1/conversations/${encodeURIComponent(row.id)}`).then(() => {
      store.hideConversation(row.id);
      store.conversations.value = store.conversations.value.filter((item) => String(item.id) !== String(row.id));
      if (store.selectedId.value === row.id) store.selectedId.value = store.filteredConversations.value[0]?.id || "";
      store.pushNotification({ title: "已删除会话", message: row.displayTitle || "会话", tone: "success", ttl: 1800 });
    }).catch((error) => {
      store.pushNotification({ title: "删除失败", message: error?.message || "暂时无法删除会话", tone: "error" });
    });
  };

  function openFriendRemark(contact) {
    remarkTarget.value = contact || null;
    remarkDraft.value = String(contact?.friendAlias || "");
    remarkDialogOpen.value = true;
  }

  function closeFriendRemark() {
    remarkDialogOpen.value = false;
  }

  async function submitFriendRemark() {
    if (!remarkTarget.value?.id) return;
    await friendCenter.updateAlias(remarkTarget.value.id, remarkDraft.value);
    await actions.loadContacts().catch(() => {});
    await actions.loadConversations().catch(() => {});
    remarkDialogOpen.value = false;
  }

  function handleGlobalPointer(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".qq-list-search-cluster") || target.closest(".qq-search-panel") || target.closest(".qq-plus-action-wrap") || target.closest(".qq-quick-create-menu") || target.closest(".new-friends-dialog-card")) return;
    searchFocused.value = false;
    quickCreateOpen.value = false;
  }

  const handleSearchInput = (value) => {
    store.conversationKeyword.value = value;
    searchFocused.value = true;
  };

  function clearSearchInput() {
    store.conversationKeyword.value = "";
    searchFocused.value = true;
    searchController.resetActive();
  }

  function handleSearchPick(item) {
    pushRecentKeyword(searchKeyword.value || item.title);
    if (item.action === "conversation") {
      store.showConversation(item.id);
      selectConversation(item.id);
      openConversation(item.id);
      return;
    }
    if (item.action === "message") {
      activePane.value = "messages";
      store.showConversation(item.id);
      selectConversation(item.id);
      openConversation(item.id);
      return;
    }
    if (item.action === "contact") {
      activePane.value = "contacts";
      openDirectConversationByContact(item.id);
    }
  }

  function handleSearchFooterPick() {
    activePane.value = "contacts";
    friendCenter.openCenter();
    friendCenter.keyword.value = searchKeyword.value;
  }

  function applyRecentKeyword(value) {
    store.conversationKeyword.value = value;
    searchFocused.value = true;
  }

  function openDirectCreation() {
    quickCreateOpen.value = false;
    activePane.value = "messages";
    actions.createDirectConversation();
  }

  function openGroupCreation() {
    quickCreateOpen.value = false;
    activePane.value = "messages";
    actions.createGroupConversation();
  }

  function handleSearchKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      searchController.move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      searchController.move(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (searchController.activeItem.value) handleSearchPick(searchController.activeItem.value);
      return;
    }
    if (event.key === "Escape") {
      searchFocused.value = false;
    }
  }

  function openNewFriendsCenter() {
    activePane.value = "contacts";
    friendCenter.openCenter();
  }

  function startChatFromNewFriends(payload) {
    activePane.value = "messages";
    openDirectConversationByContact(payload?.id || payload);
  }

  function openDirectConversationByContact(contactId) {
    if (!contactId) return;
    actions.openOrCreateDirectConversation(contactId).then((conversationId) => {
      if (conversationId) {
        store.showConversation(conversationId);
        selectConversation(conversationId);
        openConversation(conversationId);
      }
    }).catch(() => {});
  }

  onMounted(async () => {
    desktopControls.syncAppearance();
    window.addEventListener("pointerdown", handleGlobalPointer);
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
    await actions.loadContacts();
    await reloadConversationList();
    await friendCenter.refresh();
    realtime.connect();
    desktopControls.checkForUpdates().catch(() => {});
  });

  onBeforeUnmount(() => {
    window.removeEventListener("pointerdown", handleGlobalPointer);
    if (typeof detachUpdateState === "function") detachUpdateState();
    if (typeof detachDesktopPreferences === "function") detachDesktopPreferences();
    if (typeof detachOpenConversation === "function") detachOpenConversation();
    if (typeof detachAppSettings === "function") detachAppSettings();
    if (typeof detachSystemAppearance === "function") detachSystemAppearance();
    window.clearTimeout(friendSearchTimer);
    realtime.disconnect();
  });

  watch(unreadTotal, (value) => {
    window.desktopShell?.updateUnreadCount?.(value).catch?.(() => {});
  }, { immediate: true });

  watch(searchKeyword, (value) => {
    if (value) quickCreateOpen.value = false;
  });

  watch(() => friendCenter.keyword.value, () => {
    window.clearTimeout(friendSearchTimer);
    friendSearchTimer = window.setTimeout(() => {
      if (friendCenter.open.value) friendCenter.refresh();
    }, 180);
  });

  return {
    activePane,
    appInfo: desktopControls.appInfo,
    appSettings: desktopControls.appSettings,
    checkForUpdates: desktopControls.checkForUpdates,
    chooseDownloadDirectory: desktopControls.chooseDownloadDirectory,
    clearDesktopCache: desktopControls.clearDesktopCache,
    clearRecentKeywords,
    clearSearchInput,
    closeFriendRemark,
    contactRows,
    copyConversationTitle,
    desktopPreferences: desktopControls.desktopPreferences,
    filteredContacts,
    filteredFavorites,
    formatConversationTime,
    handleSearchFooterPick,
    handleAvatarUpload: desktopControls.handleAvatarUpload,
    handleRealtimeEvent,
    handleSearchInput,
    handleSearchKeydown,
    handleSearchPick,
    hideConversationFromList,
    markConversationRead,
    openDirectConversationByContact,
    openFavorite,
    openFriendRemark,
    openGroupCreation,
    openNewFriendsCenter,
    openConversation,
    openDirectCreation,
    openDownloadDirectory: desktopControls.openDownloadDirectory,
    persistDesktopPreferences: desktopControls.persistDesktopPreferences,
    persistSettings: desktopControls.persistSettings,
    quickCreateOpen,
    recentKeywords,
    reloadConversationList,
    remarkDialogOpen,
    remarkDraft,
    remarkTarget,
    remindUpdateLater: desktopControls.remindUpdateLater,
    removeFavorite,
    searchActiveKey: searchController.activeKey,
    searchFocused,
    searchKeyword,
    searchPanelOpen,
    searchSections,
    selectConversation,
    settingsOpen: desktopControls.settingsOpen,
    showUpdatePromptOpen: desktopControls.updatePromptOpen,
    startChatFromNewFriends,
    submitFriendRemark,
    toggleConversationMute,
    unreadTotal,
    updatePromptOpen: desktopControls.updatePromptOpen,
    visibleConversations,
    handleUpdateNow: desktopControls.handleUpdateNow,
    closeSettings: desktopControls.closeSettings,
    closeUpdatePrompt: desktopControls.closeUpdatePrompt,
    openSettings: desktopControls.openSettings,
  };
}
