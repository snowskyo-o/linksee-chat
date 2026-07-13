import { createChatLoadMessageActions } from "./chat-load-message-actions.js";
import { createChatLoadProfileActions } from "./chat-load-profile-actions.js";
import { createChatLoadSidebarActions } from "./chat-load-sidebar-actions.js";

export function createChatLoadActions({ store, chatApi, cacheUserId, setLoadState }) {
  const profileActions = createChatLoadProfileActions({ store, chatApi, cacheUserId });
  const sidebarActions = createChatLoadSidebarActions({ store, chatApi, cacheUserId, setLoadState });
  const messageActions = createChatLoadMessageActions({ store, chatApi, cacheUserId, setLoadState });

  async function refreshSelectedConversation() {
    await sidebarActions.loadParticipants();
    await messageActions.loadMessages();
  }

  async function refreshAll() {
    await sidebarActions.loadContacts();
    await sidebarActions.loadConversations();
    await refreshSelectedConversation();
  }

  return {
    ...profileActions,
    ...sidebarActions,
    ...messageActions,
    refreshAll,
    refreshSelectedConversation,
  };
}
