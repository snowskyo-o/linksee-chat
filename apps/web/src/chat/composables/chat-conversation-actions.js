import { createChatConversationCreateActions } from "./chat-conversation-create-actions.js";
import { createChatConversationDialogActions } from "./chat-conversation-dialog-actions.js";
import { createChatConversationStateActions } from "./chat-conversation-state-actions.js";

export function createChatConversationActions({
  store,
  chatApi,
  dataActions,
  profileActions,
  patchConversationLocally,
}) {
  async function selectConversation(conversationId) {
    await dataActions.selectConversation(conversationId);
    await profileActions.refreshProfilesIfDirty(store.participants.value.map((user) => user.id)).catch(() => {});
  }
  const createActions = createChatConversationCreateActions({ store, chatApi, dataActions });
  const dialogActions = createChatConversationDialogActions({ store, chatApi, dataActions });
  const stateActions = createChatConversationStateActions({ store, chatApi, patchConversationLocally });

  return {
    ...createActions,
    ...dialogActions,
    ...stateActions,
    selectConversation,
    openOrCreateDirectConversation(peerId) {
      return createActions.openOrCreateDirectConversation(peerId, selectConversation);
    },
  };
}
