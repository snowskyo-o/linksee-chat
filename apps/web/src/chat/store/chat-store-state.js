import { ref } from "vue";
import { loadConversationPreferences } from "../../shared/conversation-preferences.js";
import { loadFavoriteMessages } from "./chat-store-favorites.js";

function createLoadState() {
  return { status: "idle", message: "" };
}

function createCoreState(initialConversationPreferences) {
  return {
    me: ref(null),
    contacts: ref([]),
    conversations: ref([]),
    mutedConversationIds: ref(initialConversationPreferences.mutedConversationIds),
    hiddenConversationIds: ref(initialConversationPreferences.hiddenConversationIds),
    selectedId: ref(""),
    participants: ref([]),
    messages: ref([]),
    notifications: ref([]),
    hasMoreMessages: ref(false),
    loadingMoreMessages: ref(false),
    replyTo: ref(null),
    favoriteMessages: ref(loadFavoriteMessages()),
    searchKeyword: ref(""),
    socketOnline: ref(false),
    conversationKeyword: ref(""),
    messageKeyword: ref(""),
    conversationLoadState: ref(createLoadState()),
    messageLoadState: ref(createLoadState()),
  };
}

function createComposerState() {
  return {
    mentionOpen: ref(false),
    mentionStart: ref(-1),
    mentionKeyword: ref(""),
    mentionOptions: ref([]),
    messageInput: ref(""),
    pendingFiles: ref([]),
    fileTransfers: ref({}),
    uploadingFiles: ref(false),
    uploadProgress: ref(0),
    uploadFileName: ref(""),
    downloadingFile: ref(false),
    downloadProgress: ref(0),
    downloadFileName: ref(""),
    composerHint: ref(""),
    composerHintTone: ref(""),
  };
}

function createProfileState() {
  return {
    profileName: ref(""),
    profileBio: ref(""),
    profileHint: ref(""),
    profileHintTone: ref(""),
  };
}

function createDialogState() {
  return {
    createDialogOpen: ref(false),
    createDialogMode: ref("direct"),
    createDialogTitle: ref(""),
    createDialogPeerId: ref(""),
    createDialogParticipantIds: ref([]),
    createDialogHint: ref(""),
    createDialogHintTone: ref(""),
    createDialogSubmitting: ref(false),
    announcementDialogOpen: ref(false),
    announcementDraft: ref(""),
    announcementHint: ref(""),
    announcementHintTone: ref(""),
    announcementSubmitting: ref(false),
    confirmDialogOpen: ref(false),
    confirmDialogTitle: ref(""),
    confirmDialogMessage: ref(""),
    confirmDialogConfirmText: ref("确认"),
    confirmDialogSubmitting: ref(false),
    pendingConfirmAction: ref(null),
    forwardDialogOpen: ref(false),
    forwardingMessageId: ref(""),
    forwardConversationId: ref(""),
    forwardHint: ref(""),
    forwardSubmitting: ref(false),
  };
}

export function createChatStoreState() {
  const initialConversationPreferences = loadConversationPreferences();
  return {
    ...createCoreState(initialConversationPreferences),
    ...createComposerState(),
    ...createProfileState(),
    ...createDialogState(),
  };
}
