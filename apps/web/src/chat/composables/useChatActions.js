import { chatApi } from "../../shared/api-client.js";
import { createChatAttachmentQueueActions } from "./chat-attachment-queue-actions.js";
import { createChatComposerSubmitActions, postTextMessage } from "./chat-composer-submit-actions.js";
import { createChatConversationActions } from "./chat-conversation-actions.js";
import { createChatFileTransferActions } from "./chat-file-transfer-actions.js";
import { createChatDataActions } from "./chat-data-actions.js";
import { createChatMessageActions } from "./chat-message-actions.js";
import { patchConversationLocally } from "./message-operations.js";
import { createChatProfileActions } from "./chat-profile-actions.js";

export function useChatActions(store) {
  const dataActions = createChatDataActions(store, chatApi);
  const cacheUserId = () => store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
  const dirtyProfileUserIds = new Set();
  const autoReceiveQueue = new Set();
  const profileActions = createChatProfileActions({
    store,
    dataActions,
    chatApi,
    cacheUserId,
    dirtyProfileUserIds,
  });
  const conversationActions = createChatConversationActions({
    store,
    chatApi,
    dataActions,
    profileActions,
    patchConversationLocally,
  });
  const queueActions = createChatAttachmentQueueActions(store);
  const fileActions = createChatFileTransferActions({
    store,
    dataActions,
    autoReceiveQueue,
    postTextMessage: (content, mentions, replyTo, optimisticMessage) => (
      postTextMessage(store, chatApi, content, mentions, replyTo, optimisticMessage)
    ),
  });
  const composerActions = createChatComposerSubmitActions({
    store,
    chatApi,
    dataActions,
    fileActions,
  });
  const messageActions = createChatMessageActions({
    store,
    chatApi,
    dataActions,
    fileActions,
  });

  return {
    loadProfile: dataActions.loadProfile,
    loadContacts: dataActions.loadContacts,
    loadConversations: dataActions.loadConversations,
    loadParticipants: dataActions.loadParticipants,
    loadMessages: dataActions.loadMessages,
    loadOlderMessages: dataActions.loadOlderMessages,
    refreshSelectedConversation: dataActions.refreshSelectedConversation,
    refreshAll: dataActions.refreshAll,
    markConversationReadIfNeeded: dataActions.markConversationReadIfNeeded,
    saveConversationDraft: dataActions.saveConversationDraft,
    loadConversationDraft: dataActions.loadConversationDraft,
    selectConversation: conversationActions.selectConversation,
    createDirectConversation: conversationActions.createDirectConversation,
    createGroupConversation: conversationActions.createGroupConversation,
    openOrCreateDirectConversation: conversationActions.openOrCreateDirectConversation,
    submitCreateConversation: conversationActions.submitCreateConversation,
    searchMessages: dataActions.searchMessages,
    sendAnnouncement: conversationActions.sendAnnouncement,
    submitAnnouncement: conversationActions.submitAnnouncement,
    submitComposer: composerActions.submitComposer,
    uploadFiles: fileActions.uploadFiles,
    queueFiles: queueActions.queueFiles,
    downloadFile: fileActions.downloadFile,
    saveFileAs: fileActions.saveFileAs,
    openFile: fileActions.openFile,
    openFileLocation: fileActions.openFileLocation,
    copyImageToClipboard: fileActions.copyImageToClipboard,
    autoReceiveImages: fileActions.autoReceiveImages,
    handleMessageAction: messageActions.handleMessageAction,
    submitForwardMessage: conversationActions.submitForwardMessage,
    submitConfirmDialog: conversationActions.submitConfirmDialog,
    toggleConversationPin: conversationActions.toggleConversationPin,
    toggleConversationPinById: conversationActions.toggleConversationPinById,
    markConversationReadById: conversationActions.markConversationReadById,
    saveProfile: profileActions.saveProfile,
    uploadAvatar: profileActions.uploadAvatar,
    applyUserProfileUpdate: profileActions.applyUserProfileUpdate,
    markProfileDirty: profileActions.markProfileDirty,
    refreshProfilesIfDirty: profileActions.refreshProfilesIfDirty,
  };
}
