import { formatConversationTime, useRecentKeywords } from "./useRecentKeywords.js";
import { useConversationListActions } from "./useConversationListActions.js";
import { useConversationListDerivedState } from "./useConversationListDerivedState.js";
import { useConversationListLifecycle } from "./useConversationListLifecycle.js";
import { useConversationListRemarkActions } from "./useConversationListRemarkActions.js";
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
  const derivedState = useConversationListDerivedState(store);
  const { recentKeywords, pushRecentKeyword, clearRecentKeywords } = useRecentKeywords();
  const searchSections = useConversationSearchSections(store, derivedState.searchKeyword, derivedState.contactRows);

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
    derivedState.activePane.value = "messages";
    await actions.loadConversations().catch(() => {});
    store.showConversation(conversationId);
    store.selectedId.value = conversationId;
  }

  function handleGlobalPointer(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest(".qq-list-search-cluster") || target.closest(".qq-search-panel") || target.closest(".qq-plus-action-wrap") || target.closest(".qq-quick-create-menu") || target.closest(".new-friends-dialog-card")) return;
    derivedState.searchFocused.value = false;
    derivedState.quickCreateOpen.value = false;
  }

  const conversationActions = useConversationListActions({
    actions,
    activePane: derivedState.activePane,
    friendCenter,
    openConversation,
    searchKeyword: derivedState.searchKeyword,
    selectConversation,
    store,
  });
  const remarkActions = useConversationListRemarkActions({
    actions,
    friendCenter,
    remarkDialogOpen: derivedState.remarkDialogOpen,
    remarkDraft: derivedState.remarkDraft,
    remarkTarget: derivedState.remarkTarget,
  });
  const searchRuntime = useConversationListSearchRuntime({
    activePane: derivedState.activePane,
    openConversation,
    openDirectConversationByContact: conversationActions.openDirectConversationByContact,
    openSearchFooter: conversationActions.handleSearchFooterPick,
    pushRecentKeyword,
    recentKeywords,
    searchKeyword: derivedState.searchKeyword,
    searchPanelOpen: {
      open: derivedState.searchPanelOpen,
      quickCreateOpen: derivedState.quickCreateOpen,
      searchFocused: derivedState.searchFocused,
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
    quickCreateOpen: derivedState.quickCreateOpen,
    realtime,
    reloadConversationList: conversationActions.reloadConversationList,
    searchKeyword: derivedState.searchKeyword,
    unreadTotal: derivedState.unreadTotal,
  });

  return {
    activePane: derivedState.activePane,
    appInfo: desktopControls.appInfo,
    appSettings: desktopControls.appSettings,
    checkForUpdates: desktopControls.checkForUpdates,
    chooseDownloadDirectory: desktopControls.chooseDownloadDirectory,
    clearDesktopCache: desktopControls.clearDesktopCache,
    clearRecentKeywords,
    clearSearchInput: searchRuntime.clearSearchInput,
    closeFriendRemark: remarkActions.closeFriendRemark,
    contactRows: derivedState.contactRows,
    copyConversationTitle: conversationActions.copyConversationTitle,
    desktopPreferences: desktopControls.desktopPreferences,
    filteredContacts: derivedState.filteredContacts,
    filteredFavorites: derivedState.filteredFavorites,
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
    openFriendRemark: remarkActions.openFriendRemark,
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
    remarkDialogOpen: derivedState.remarkDialogOpen,
    remarkDraft: derivedState.remarkDraft,
    remarkTarget: derivedState.remarkTarget,
    remindUpdateLater: desktopControls.remindUpdateLater,
    removeFavorite: conversationActions.removeFavorite,
    searchActiveKey: searchRuntime.searchActiveKey,
    searchFocused: searchRuntime.searchFocused,
    searchKeyword: derivedState.searchKeyword,
    searchPanelOpen: derivedState.searchPanelOpen,
    searchSections,
    selectConversation,
    settingsOpen: desktopControls.settingsOpen,
    showUpdatePromptOpen: desktopControls.updatePromptOpen,
    startChatFromNewFriends: conversationActions.startChatFromNewFriends,
    submitFriendRemark: remarkActions.submitFriendRemark,
    toggleConversationMute: conversationActions.toggleConversationMute,
    unreadTotal: derivedState.unreadTotal,
    updatePromptOpen: desktopControls.updatePromptOpen,
    visibleConversations: derivedState.visibleConversations,
    handleUpdateNow: desktopControls.handleUpdateNow,
    closeSettings: desktopControls.closeSettings,
    closeUpdatePrompt: desktopControls.closeUpdatePrompt,
    openSettings: desktopControls.openSettings,
  };
}
