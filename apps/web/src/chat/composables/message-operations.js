import { resolveMediaUrl } from "../../shared/media.js";

export function buildOptimisticTextMessage(store, content, mentions = [], replyTo = null) {
  const now = new Date().toISOString();
  const me = store.me.value || {};
  return {
    id: `local-${Date.now()}`,
    clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: store.selectedId.value,
    senderId: me.id || localStorage.getItem("chat_user_id") || "",
    sender: me,
    content,
    type: "text",
    mentions,
    files: [],
    createdAt: now,
    updatedAt: now,
    editedAt: null,
    deletedAt: null,
    replyTo,
    operationState: "sending",
  };
}

export function buildFileMessageContent(files) {
  if (!Array.isArray(files) || files.length === 0) return "附件";
  if (files.length === 1) return files[0].name || "附件";
  if (files.length === 2) return `${files[0].name || "附件"}、${files[1].name || "附件"}`;
  return `${files[0].name || "附件"} 等 ${files.length} 个文件`;
}

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
      content: messageLike?.content || item.lastMessage?.content || "",
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

export function normalizeUser(user) {
  return {
    ...user,
    profile: {
      ...(user?.profile || {}),
      avatarUrl: resolveMediaUrl(user?.profile?.avatarUrl || ""),
    },
  };
}

export function normalizeMessage(message) {
  if (!message) return message;
  return {
    ...message,
    operationState: message.operationState || "",
    sendError: message.sendError || "",
    sender: message.sender ? normalizeUser(message.sender) : message.sender,
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          sender: message.replyTo.sender ? normalizeUser(message.replyTo.sender) : message.replyTo.sender,
        }
      : message.replyTo,
  };
}

export function findMessage(store, messageId) {
  return store.messages.value.find((item) => String(item.id) === String(messageId)) || null;
}
