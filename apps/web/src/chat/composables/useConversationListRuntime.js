import { formatConversationTime, useRecentKeywords } from "./useRecentKeywords.js";
import { useConversationListActions } from "./useConversationListActions.js";
import { useConversationListDerivedState } from "./useConversationListDerivedState.js";
import { useConversationListLifecycle } from "./useConversationListLifecycle.js";
import { useConversationListRemarkActions } from "./useConversationListRemarkActions.js";
import { useConversationSearchSections } from "./useConversationSearchSections.js";
import { useChatDesktopControls } from "./useChatDesktopControls.js";
import { useConversationListSearchRuntime } from "./useConversationListSearchRuntime.js";
import { createConversationListRuntimeHandlers } from "./conversation-list-runtime-handlers.js";
import { buildConversationListRuntime } from "./conversation-list-runtime-exports.js";

export function useConversationListRuntime({ auth, store, actions, realtime, friendCenter, selectConversation }) {
  const desktopControls = useChatDesktopControls({ store, actions });
  const derivedState = useConversationListDerivedState(store);
  const { recentKeywords, pushRecentKeyword, clearRecentKeywords } = useRecentKeywords();
  const searchSections = useConversationSearchSections(store, derivedState.searchKeyword, derivedState.contactRows);
  const openChatWindow = async (id) => {
    if (typeof window.desktopShell?.openChatWindow === "function") await window.desktopShell.openChatWindow(id);
  };
  const runtimeHandlers = createConversationListRuntimeHandlers({ actions, derivedState, openChatWindow, store });
  const conversationActions = useConversationListActions({
    actions,
    activePane: derivedState.activePane,
    friendCenter,
    openConversation: runtimeHandlers.openConversation,
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
    openConversation: runtimeHandlers.openConversation,
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
    handleDesktopOpenConversation: runtimeHandlers.handleDesktopOpenConversation,
    handleGlobalPointer: runtimeHandlers.handleGlobalPointer,
    quickCreateOpen: derivedState.quickCreateOpen,
    realtime,
    reloadConversationList: conversationActions.reloadConversationList,
    searchKeyword: derivedState.searchKeyword,
    unreadTotal: derivedState.unreadTotal,
  });

  return buildConversationListRuntime({
    actionsMap: {
      ...conversationActions,
      handleRealtimeEvent: runtimeHandlers.handleRealtimeEvent,
      openConversation: runtimeHandlers.openConversation,
    },
    clearRecentKeywords,
    desktopControls,
    derivedState,
    formatConversationTime,
    recentKeywords,
    remarkActions,
    searchRuntime,
    searchSections,
    selectConversation,
  });
}
