import { ref } from "vue";
import { loadConversationPreferences } from "../../shared/conversation-preferences.js";
import { createChatStoreActions } from "./chat-store-actions.js";
import { createChatStoreDerived } from "./chat-store-derived.js";

const FAVORITES_STORAGE_KEY = "linksee_chat_favorite_messages";

function loadFavoriteMessages() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter(Boolean).map((item) => ({
      id: String(item.id || ""),
      conversationId: String(item.conversationId || ""),
      conversationTitle: String(item.conversationTitle || "收藏消息"),
      senderName: String(item.senderName || "未知用户"),
      content: String(item.content || ""),
      createdAt: String(item.createdAt || ""),
    })).filter((item) => item.id && item.conversationId) : [];
  } catch {
    return [];
  }
}

function saveFavoriteMessages(items) {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(items));
}

export function useChatStore(auth) {
  const initialConversationPreferences = loadConversationPreferences();
  const initialLoadState = () => ({ status: "idle", message: "" });
  const me = ref(null);
  const contacts = ref([]);
  const conversations = ref([]);
  const mutedConversationIds = ref(initialConversationPreferences.mutedConversationIds);
  const hiddenConversationIds = ref(initialConversationPreferences.hiddenConversationIds);
  const selectedId = ref("");
  const participants = ref([]);
  const messages = ref([]);
  const notifications = ref([]);
  const hasMoreMessages = ref(false);
  const loadingMoreMessages = ref(false);
  const replyTo = ref(null);
  const favoriteMessages = ref(loadFavoriteMessages());
  const mentionOpen = ref(false);
  const mentionStart = ref(-1);
  const mentionKeyword = ref("");
  const mentionOptions = ref([]);
  const searchKeyword = ref("");
  const socketOnline = ref(false);
  const conversationKeyword = ref("");
  const messageKeyword = ref("");
  const messageInput = ref("");
  const pendingFiles = ref([]);
  const fileTransfers = ref({});
  const uploadingFiles = ref(false);
  const uploadProgress = ref(0);
  const uploadFileName = ref("");
  const downloadingFile = ref(false);
  const downloadProgress = ref(0);
  const downloadFileName = ref("");
  const composerHint = ref("");
  const composerHintTone = ref("");
  const profileName = ref("");
  const profileBio = ref("");
  const profileHint = ref("");
  const profileHintTone = ref("");
  const createDialogOpen = ref(false);
  const createDialogMode = ref("direct");
  const createDialogTitle = ref("");
  const createDialogPeerId = ref("");
  const createDialogParticipantIds = ref([]);
  const createDialogHint = ref("");
  const createDialogHintTone = ref("");
  const createDialogSubmitting = ref(false);
  const announcementDialogOpen = ref(false);
  const announcementDraft = ref("");
  const announcementHint = ref("");
  const announcementHintTone = ref("");
  const announcementSubmitting = ref(false);
  const confirmDialogOpen = ref(false);
  const confirmDialogTitle = ref("");
  const confirmDialogMessage = ref("");
  const confirmDialogConfirmText = ref("确认");
  const confirmDialogSubmitting = ref(false);
  const pendingConfirmAction = ref(null);
  const forwardDialogOpen = ref(false);
  const forwardingMessageId = ref("");
  const forwardConversationId = ref("");
  const forwardHint = ref("");
  const forwardSubmitting = ref(false);
  const conversationLoadState = ref(initialLoadState());
  const messageLoadState = ref(initialLoadState());

  const state = {
    announcementDialogOpen,
    announcementDraft,
    announcementHint,
    announcementHintTone,
    announcementSubmitting,
    composerHint,
    composerHintTone,
    confirmDialogConfirmText,
    confirmDialogMessage,
    confirmDialogOpen,
    confirmDialogSubmitting,
    confirmDialogTitle,
    contacts,
    conversationKeyword,
    conversationLoadState,
    conversations,
    createDialogHint,
    createDialogHintTone,
    createDialogMode,
    createDialogOpen,
    createDialogParticipantIds,
    createDialogPeerId,
    createDialogSubmitting,
    createDialogTitle,
    downloadFileName,
    downloadProgress,
    downloadingFile,
    favoriteMessages,
    fileTransfers,
    forwardConversationId,
    forwardDialogOpen,
    forwardHint,
    forwardingMessageId,
    forwardSubmitting,
    hasMoreMessages,
    hiddenConversationIds,
    loadingMoreMessages,
    mentionKeyword,
    mentionOpen,
    mentionOptions,
    mentionStart,
    me,
    messageInput,
    messageKeyword,
    messageLoadState,
    messages,
    mutedConversationIds,
    notifications,
    participants,
    pendingConfirmAction,
    pendingFiles,
    profileBio,
    profileHint,
    profileHintTone,
    profileName,
    replyTo,
    searchKeyword,
    selectedId,
    socketOnline,
    uploadFileName,
    uploadProgress,
    uploadingFiles,
  };

  const derived = createChatStoreDerived(auth, state);
  const actions = createChatStoreActions(state, derived, saveFavoriteMessages);

  return {
    me,
    contacts,
    conversations,
    selectedId,
    participants,
    messages,
    notifications,
    mutedConversationIds,
    hiddenConversationIds,
    hasMoreMessages,
    loadingMoreMessages,
    replyTo,
    favoriteMessages,
    mentionOpen,
    mentionStart,
    mentionKeyword,
    mentionOptions,
    searchKeyword,
    socketOnline,
    conversationKeyword,
    messageKeyword,
    messageInput,
    pendingFiles,
    fileTransfers,
    uploadingFiles,
    uploadProgress,
    uploadFileName,
    downloadingFile,
    downloadProgress,
    downloadFileName,
    composerHint,
    composerHintTone,
    profileName,
    profileBio,
    profileHint,
    profileHintTone,
    createDialogOpen,
    createDialogMode,
    createDialogTitle,
    createDialogPeerId,
    createDialogParticipantIds,
    createDialogHint,
    createDialogHintTone,
    createDialogSubmitting,
    announcementDialogOpen,
    announcementDraft,
    announcementHint,
    announcementHintTone,
    announcementSubmitting,
    confirmDialogOpen,
    confirmDialogTitle,
    confirmDialogMessage,
    confirmDialogConfirmText,
    confirmDialogSubmitting,
    pendingConfirmAction,
    forwardDialogOpen,
    forwardingMessageId,
    forwardConversationId,
    forwardHint,
    forwardSubmitting,
    conversationLoadState,
    messageLoadState,
    ...derived,
    ...actions,
  };
}
