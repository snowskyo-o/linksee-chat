export function createConversationEntryActions({ activePane, actions, friendCenter, openConversation, searchKeyword, selectConversation, store }) {
  async function openFavorite(item) {
    if (!item?.conversationId) return;
    activePane.value = "messages";
    await openConversation(item.conversationId);
  }

  function openDirectConversationByContact(contactId) {
    if (!contactId) return;
    actions.openOrCreateDirectConversation(contactId).then((conversationId) => {
      if (!conversationId) return;
      store.showConversation(conversationId);
      selectConversation(conversationId);
      openConversation(conversationId);
    }).catch(() => {});
  }

  function openNewFriendsCenter() {
    activePane.value = "contacts";
    friendCenter.openCenter();
  }

  function startChatFromNewFriends(payload) {
    activePane.value = "messages";
    openDirectConversationByContact(payload?.id || payload);
  }

  function openDirectCreation() {
    activePane.value = "messages";
    actions.createDirectConversation();
  }

  function openGroupCreation() {
    activePane.value = "messages";
    actions.createGroupConversation();
  }

  function handleSearchFooterPick() {
    activePane.value = "contacts";
    friendCenter.openCenter();
    friendCenter.keyword.value = searchKeyword.value;
  }

  return {
    handleSearchFooterPick,
    openDirectConversationByContact,
    openDirectCreation,
    openFavorite,
    openGroupCreation,
    openNewFriendsCenter,
    startChatFromNewFriends,
  };
}
