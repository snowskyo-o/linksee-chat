import { chatApi } from "../../shared/api-client.js";

export function useConversationListActions({
  actions,
  activePane,
  friendCenter,
  openConversation,
  searchKeyword,
  selectConversation,
  store,
}) {
  async function reloadConversationList() {
    await actions.loadConversations().catch((error) => {
      store.pushNotification({ title: "加载失败", message: error?.message || "暂时无法获取会话列表", tone: "error" });
    });
  }

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

  const removeFavorite = (item) => store.removeFavoriteMessage(item?.id);
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

  function handleSearchFooterPick() {
    activePane.value = "contacts";
    friendCenter.openCenter();
    friendCenter.keyword.value = searchKeyword.value;
  }

  return {
    copyConversationTitle,
    handleSearchFooterPick,
    hideConversationFromList,
    markConversationRead,
    openDirectConversationByContact,
    openDirectCreation,
    openFavorite,
    openGroupCreation,
    openNewFriendsCenter,
    reloadConversationList,
    removeFavorite,
    startChatFromNewFriends,
    toggleConversationMute,
  };
}
