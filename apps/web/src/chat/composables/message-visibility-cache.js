import { buildDerivedMessagePreview } from "../store/chat-store-derived-utils.js";

const STORAGE_KEY = "linksee_chat_message_visibility_v1";

function loadState() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(nextState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function normalizePreview(message) {
  if (!message?.id) return null;
  return {
    id: String(message.id),
    content: buildDerivedMessagePreview(message),
    type: String(message.type || "text"),
    createdAt: String(message.createdAt || new Date().toISOString()),
    deletedAt: message.deletedAt || null,
    files: Array.isArray(message.files) ? message.files : [],
  };
}

function readBucket(userId, conversationId) {
  const state = loadState();
  return state?.[String(userId || "")]?.[String(conversationId || "")] || null;
}

function writeBucket(userId, conversationId, nextBucket) {
  const state = loadState();
  const nextState = {
    ...state,
    [String(userId || "")]: {
      ...(state?.[String(userId || "")] || {}),
      [String(conversationId || "")]: nextBucket,
    },
  };
  saveState(nextState);
}

export function filterLocallyVisibleMessages(userId, conversationId, messages = []) {
  const hiddenIds = new Set((readBucket(userId, conversationId)?.ids || []).map((item) => String(item || "")));
  if (!hiddenIds.size) return Array.isArray(messages) ? messages : [];
  return (Array.isArray(messages) ? messages : []).filter((message) => !hiddenIds.has(String(message?.id || "")));
}

export function applyLocalConversationVisibility(userId, conversations = []) {
  return (Array.isArray(conversations) ? conversations : []).map((conversation) => {
    const bucket = readBucket(userId, conversation?.id);
    if (!bucket?.ids?.length || !conversation?.lastMessage?.id) return conversation;
    if (!bucket.ids.includes(String(conversation.lastMessage.id))) return conversation;
    return {
      ...conversation,
      lastMessage: bucket.fallbackPreview || null,
    };
  });
}

export function rememberLocallyDeletedMessage(userId, conversationId, messageId, fallbackPreview = null) {
  const bucket = readBucket(userId, conversationId) || { ids: [], fallbackPreview: null };
  const hiddenIds = Array.from(new Set([...bucket.ids.map((item) => String(item || "")), String(messageId || "")]));
  writeBucket(userId, conversationId, {
    ids: hiddenIds,
    fallbackPreview: normalizePreview(fallbackPreview),
  });
}

export function pickVisibleConversationPreview(messages = [], removedMessageId = "") {
  const visibleMessages = (Array.isArray(messages) ? messages : []).filter((message) => (
    String(message?.id || "") !== String(removedMessageId || "")
  ));
  return normalizePreview(visibleMessages[visibleMessages.length - 1] || null);
}
