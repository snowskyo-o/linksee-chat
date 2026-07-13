import { createConversationEntryActions } from "./conversation-list-entry-actions.js";
import { createConversationNotificationActions } from "./conversation-list-notification-actions.js";

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
  const entryActions = createConversationEntryActions({
    activePane, actions, friendCenter, openConversation, searchKeyword, selectConversation, store,
  });
  const notificationActions = createConversationNotificationActions({ actions, store });

  return {
    reloadConversationList,
    ...entryActions,
    ...notificationActions,
  };
}
