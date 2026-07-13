import { buildDerivedMessagePreview } from "../store/chat-store-derived-utils.js";

export function patchConversationLocally(store, conversationId, patch) {
  store.conversations.value = store.conversations.value.map((item) => (
    String(item.id) === String(conversationId)
      ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
      : item
  ));
}

export function patchUserProfileLocally(store, userId, profilePatch) {
  const targetUserId = String(userId || "");
  if (!targetUserId) return;
  const applyProfilePatch = (user) => {
    if (!user || String(user.id) !== targetUserId) return user;
    return {
      ...user,
      profile: {
        ...(user.profile || {}),
        ...(typeof profilePatch === "function" ? profilePatch(user.profile || {}, user) : profilePatch),
      },
    };
  };

  store.me.value = applyProfilePatch(store.me.value);
  store.contacts.value = store.contacts.value.map((user) => applyProfilePatch(user));
  store.participants.value = store.participants.value.map((user) => applyProfilePatch(user));
  store.conversations.value = store.conversations.value.map((conversation) => ({
    ...conversation,
    participants: Array.isArray(conversation?.participants)
      ? conversation.participants.map((user) => applyProfilePatch(user))
      : conversation.participants,
  }));
  store.messages.value = store.messages.value.map((message) => ({
    ...message,
    sender: applyProfilePatch(message.sender),
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          sender: applyProfilePatch(message.replyTo.sender),
        }
      : message.replyTo,
  }));
}

export function syncConversationPreview(store, conversationId, messageLike) {
  patchConversationLocally(store, conversationId, (item) => ({
    ...item,
    updatedAt: messageLike?.createdAt || new Date().toISOString(),
    unreadCount: 0,
    unreadMentionCount: 0,
    lastMessage: {
      ...(item.lastMessage || {}),
      id: messageLike?.id || item.lastMessage?.id,
      content: buildDerivedMessagePreview(messageLike) || item.lastMessage?.content || "",
      type: messageLike?.type || item.lastMessage?.type || "text",
      createdAt: messageLike?.createdAt || new Date().toISOString(),
      deletedAt: messageLike?.deletedAt || null,
      files: messageLike?.files || [],
    },
  }));
}

export function patchMessageLocally(store, messageId, patch) {
  store.messages.value = store.messages.value.map((item) => (
    String(item.id) === String(messageId)
      ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
      : item
  ));
}

export function replaceMessageLocally(store, messageId, nextMessage) {
  store.messages.value = store.messages.value.map((item) => (
    String(item.id) === String(messageId) ? nextMessage : item
  ));
}

export function removeMessageLocally(store, messageId) {
  store.messages.value = store.messages.value.filter((item) => String(item.id) !== String(messageId));
}

export function findMessage(store, messageId) {
  return store.messages.value.find((item) => String(item.id) === String(messageId)) || null;
}
