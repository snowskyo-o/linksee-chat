import { useListSearch } from "./useListSearch.js";

export function useConversationListSearchRuntime({
  activePane,
  openConversation,
  openDirectConversationByContact,
  openSearchFooter,
  pushRecentKeyword,
  recentKeywords,
  searchKeyword,
  searchPanelOpen,
  searchSections,
  selectConversation,
  store,
}) {
  const searchFocused = searchPanelOpen.searchFocused;
  const quickCreateOpen = searchPanelOpen.quickCreateOpen;
  const searchController = useListSearch({
    openRef: searchPanelOpen.open,
    keywordRef: searchKeyword,
    recentKeywordsRef: recentKeywords,
    sectionsRef: searchSections,
    onPick: (item) => handleSearchPick(item),
    onRecentPick: (value) => applyRecentKeyword(value),
    onFooterPick: () => openSearchFooter(),
  });

  function handleSearchInput(value) {
    store.conversationKeyword.value = value;
    searchFocused.value = true;
  }

  function clearSearchInput() {
    store.conversationKeyword.value = "";
    searchFocused.value = true;
    searchController.resetActive();
  }

  function handleSearchPick(item) {
    pushRecentKeyword(searchKeyword.value || item.title);
    if (item.action === "conversation" || item.action === "message") {
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

  function applyRecentKeyword(value) {
    store.conversationKeyword.value = value;
    searchFocused.value = true;
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
    if (event.key === "Escape") searchFocused.value = false;
  }

  return {
    clearSearchInput,
    handleSearchInput,
    handleSearchKeydown,
    handleSearchPick,
    quickCreateOpen,
    searchActiveKey: searchController.activeKey,
    searchFocused,
  };
}
