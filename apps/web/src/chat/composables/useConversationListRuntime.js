import { computed, ref } from "vue";
import { formatConversationTime, useRecentKeywords } from "./useRecentKeywords.js";
import { useConversationListActions } from "./useConversationListActions.js";
import { useConversationListLifecycle } from "./useConversationListLifecycle.js";
import { useConversationSearchSections } from "./useConversationSearchSections.js";
import { useChatDesktopControls } from "./useChatDesktopControls.js";
import { useConversationListSearchRuntime } from "./useConversationListSearchRuntime.js";

export function useConversationListRuntime({
  auth,
  store,
  actions,
  realtime,
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

  async function handleDesktopOpenConversation(payload = {}) {
    const conversationId = String(payload.conversationId || "").trim();
    if (!conversationId) return;
    activePane.value = "messages";
    await actions.loadConversations().catch(() => {});
    store.showConversation(conversationId);
    store.selectedId.value = conversationId;
  }

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

  const conversationActions = useConversationListActions({
    actions,
    activePane,
    friendCenter,
    openConversation,
    searchKeyword,
    selectConversation,
    store,
  });
  const searchRuntime = useConversationListSearchRuntime({
    activePane,
    openConversation,
    openDirectConversationByContact: conversationActions.openDirectConversationByContact,
    openSearchFooter: conversationActions.handleSearchFooterPick,
    pushRecentKeyword,
    recentKeywords,
    searchKeyword,
    searchPanelOpen: {
      open: searchPanelOpen,
      quickCreateOpen,
      searchFocused,
    },
    searchSections,
    selectConversation,
    store,
  });
  useConversationListLifecycle({
    actions,
    auth,
    desktopControls,
    friendCenter,
    handleDesktopOpenConversation,
    handleGlobalPointer,
    quickCreateOpen,
    realtime,
    reloadConversationList: conversationActions.reloadConversationList,
    searchKeyword,
    unreadTotal,
  });

  return {
    activePane,
    appInfo: desktopControls.appInfo,
    appSettings: desktopControls.appSettings,
    checkForUpdates: desktopControls.checkForUpdates,
    chooseDownloadDirectory: desktopControls.chooseDownloadDirectory,
    clearDesktopCache: desktopControls.clearDesktopCache,
    clearRecentKeywords,
    clearSearchInput: searchRuntime.clearSearchInput,
    closeFriendRemark,
    contactRows,
    copyConversationTitle: conversationActions.copyConversationTitle,
    desktopPreferences: desktopControls.desktopPreferences,
    filteredContacts,
    filteredFavorites,
    formatConversationTime,
    handleSearchFooterPick: conversationActions.handleSearchFooterPick,
    handleAvatarUpload: desktopControls.handleAvatarUpload,
    handleRealtimeEvent,
    handleSearchInput: searchRuntime.handleSearchInput,
    handleSearchKeydown: searchRuntime.handleSearchKeydown,
    handleSearchPick: searchRuntime.handleSearchPick,
    hideConversationFromList: conversationActions.hideConversationFromList,
    markConversationRead: conversationActions.markConversationRead,
    openDirectConversationByContact: conversationActions.openDirectConversationByContact,
    openFavorite: conversationActions.openFavorite,
    openFriendRemark,
    openGroupCreation: conversationActions.openGroupCreation,
    openNewFriendsCenter: conversationActions.openNewFriendsCenter,
    openConversation,
    openDirectCreation: conversationActions.openDirectCreation,
    openDownloadDirectory: desktopControls.openDownloadDirectory,
    persistDesktopPreferences: desktopControls.persistDesktopPreferences,
    persistSettings: desktopControls.persistSettings,
    quickCreateOpen: searchRuntime.quickCreateOpen,
    recentKeywords,
    reloadConversationList: conversationActions.reloadConversationList,
    remarkDialogOpen,
    remarkDraft,
    remarkTarget,
    remindUpdateLater: desktopControls.remindUpdateLater,
    removeFavorite: conversationActions.removeFavorite,
    searchActiveKey: searchRuntime.searchActiveKey,
    searchFocused: searchRuntime.searchFocused,
    searchKeyword,
    searchPanelOpen,
    searchSections,
    selectConversation,
    settingsOpen: desktopControls.settingsOpen,
    showUpdatePromptOpen: desktopControls.updatePromptOpen,
    startChatFromNewFriends: conversationActions.startChatFromNewFriends,
    submitFriendRemark,
    toggleConversationMute: conversationActions.toggleConversationMute,
    unreadTotal,
    updatePromptOpen: desktopControls.updatePromptOpen,
    visibleConversations,
    handleUpdateNow: desktopControls.handleUpdateNow,
    closeSettings: desktopControls.closeSettings,
    closeUpdatePrompt: desktopControls.closeUpdatePrompt,
    openSettings: desktopControls.openSettings,
  };
}
