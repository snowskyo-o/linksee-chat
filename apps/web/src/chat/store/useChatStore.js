import { computed, ref } from "vue";
import { resolveMediaUrl } from "../../shared/media.js";
import { loadConversationPreferences, saveConversationPreferences } from "../../shared/conversation-preferences.js";
import { escapeHtml, formatDateTime, formatExpiry, formatFileSize, getInitials } from "../../shared/utils.js";

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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function conversationRank(row) {
  const pinnedRank = row.pinnedAt ? 1 : 0;
  const mentionRank = Number(row.unreadMentionCount || 0) > 0 ? 1 : 0;
  const unreadRank = Number(row.unreadCount || 0) > 0 ? 1 : 0;
  const timeRank = new Date(row.pinnedAt || row.updatedAt || 0).getTime();
  return { pinnedRank, mentionRank, unreadRank, timeRank };
}

function buildConversationTitle(row, authUserId) {
  if (!row) return "未命名会话";
  if (row.title) return row.title;
  if (row.kind === "direct") {
    const peer = (row.participants || []).find((item) => item.id !== authUserId);
    return peer?.profile?.realName || peer?.id || "单聊";
  }
  return "群聊";
}

function buildConversationSubtitle(row, authUserId) {
  if (!row) return "";
  if (row.kind === "direct") {
    const peer = (row.participants || []).find((item) => item.id !== authUserId);
    return peer?.profile?.bio || "私聊";
  }
  const count = Array.isArray(row.participants) ? row.participants.length : 0;
  return count > 0 ? `${count} 位成员` : "群聊";
}

function buildPreview(row) {
  if (!row?.lastMessage) return "还没有消息";
  if (row.lastMessage.deletedAt) return "消息已撤回";
  if (row.lastMessage.type === "announcement") return `【公告】${row.lastMessage.content || ""}`;
  if (row.lastMessage.type === "file") return row.lastMessage.content || "[文件]";
  return row.lastMessage.content || "[空消息]";
}

function buildReplyText(message) {
  if (!message?.replyTo) return "";
  const replySenderName = message.replyTo.sender?.profile?.realName || message.replyTo.senderId || "对方";
  const replyContent = message.replyTo.content
    || (Array.isArray(message.replyTo.files) && message.replyTo.files.length
      ? message.replyTo.files.map((file) => file.name || "附件").join("、")
      : "");
  return `回复 ${replySenderName}：${replyContent}`;
}

export function useChatStore(auth) {
  const initialConversationPreferences = loadConversationPreferences();
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

  const meName = computed(() => me.value?.profile?.realName || auth.userId || "未登录");
  const meMeta = computed(() => me.value?.profile?.bio || "保持联络，保持专注");
  const meAvatar = computed(() => getInitials(meName.value, auth.userId));
  const meAvatarUrl = computed(() => resolveMediaUrl(me.value?.profile?.avatarUrl || ""));
  const selectedConversation = computed(() => conversations.value.find((item) => item.id === selectedId.value) || null);
  const selectedPeerId = computed(() => createDialogPeerId.value || contacts.value[0]?.id || "");
  const selectedParticipants = computed(() => contacts.value.filter((user) => createDialogParticipantIds.value.includes(user.id)));
  const createDialogContacts = computed(() => contacts.value.map((user) => ({
    id: user.id,
    name: user.profile?.realName || user.id,
    bio: user.profile?.bio || "",
    avatarUrl: resolveMediaUrl(user.profile?.avatarUrl || ""),
  })));
  const uploadProgressText = computed(() => {
    if (!uploadingFiles.value) return "";
    if (!uploadFileName.value) return `上传中 ${uploadProgress.value}%`;
    return `正在上传 ${uploadFileName.value} · ${uploadProgress.value}%`;
  });
  const downloadProgressText = computed(() => {
    if (!downloadingFile.value) return "";
    if (!downloadFileName.value) return `下载中 ${downloadProgress.value}%`;
    return `正在下载 ${downloadFileName.value} · ${downloadProgress.value}%`;
  });

  const conversationRows = computed(() => (
    conversations.value
      .map((row) => {
        const title = buildConversationTitle(row, auth.userId);
        const subtitle = buildConversationSubtitle(row, auth.userId);
        const peer = row.kind === "direct"
          ? (row.participants || []).find((item) => item.id !== auth.userId)
          : null;

        return {
          ...row,
          displayTitle: title,
          displaySubtitle: subtitle,
          isMuted: mutedConversationIds.value.includes(String(row.id || "")),
          isHidden: hiddenConversationIds.value.includes(String(row.id || "")),
          avatarUrl: row.kind === "direct" ? resolveMediaUrl(peer?.profile?.avatarUrl || "") : "",
          preview: buildPreview(row),
        };
      })
      .sort((a, b) => {
        const aRank = conversationRank(a);
        const bRank = conversationRank(b);
        if (aRank.pinnedRank !== bRank.pinnedRank) return bRank.pinnedRank - aRank.pinnedRank;
        if (aRank.mentionRank !== bRank.mentionRank) return bRank.mentionRank - aRank.mentionRank;
        if (aRank.unreadRank !== bRank.unreadRank) return bRank.unreadRank - aRank.unreadRank;
        return bRank.timeRank - aRank.timeRank;
      })
  ));

  const filteredConversations = computed(() => {
    const keyword = conversationKeyword.value.trim().toLowerCase();
    const visibleRows = conversationRows.value.filter((row) => !row.isHidden);
    if (!keyword) return visibleRows;
    return visibleRows.filter((row) => (
      [row.displayTitle, row.displaySubtitle, row.preview]
        .some((value) => String(value || "").toLowerCase().includes(keyword))
    ));
  });

  const chatTitle = computed(() => buildConversationTitle(selectedConversation.value, auth.userId) || "请选择会话");
  const chatSubtitle = computed(() => (
    selectedConversation.value
      ? buildConversationSubtitle(selectedConversation.value, auth.userId)
      : "选择一个会话开始聊天"
  ));

  const renderedMessages = computed(() => messages.value.map((message) => {
    const senderName = message.sender?.profile?.realName || message.senderId || "未知用户";
    const deleted = Boolean(message.deletedAt);
    const isFileMessage = Array.isArray(message.files) && message.files.length > 0;
    let html = deleted ? "" : escapeHtml(message.content || "");

    participants.value.forEach((user) => {
      const name = user.profile?.realName || "";
      if (!name) return;
      const token = `@${name}`;
      html = html.split(escapeHtml(token)).join(`<span class="mention">${escapeHtml(token)}</span>`);
    });

    const activeSearch = searchKeyword.value.trim();
    if (activeSearch) {
      const pattern = new RegExp(`(${escapeRegExp(escapeHtml(activeSearch))})`, "gi");
      html = html.replace(pattern, '<mark class="message-search-mark">$1</mark>');
    }

    return {
      ...message,
      senderName,
      isSystemNote: deleted,
      systemText: String(message.senderId) === String(auth.userId)
        ? "你撤回了一条消息"
        : `${senderName} 撤回了一条消息`,
      operationState: message.operationState || "",
      statusText: message.operationState === "sending"
        ? "发送中"
        : message.operationState === "failed"
          ? "发送失败"
          : message.operationState === "recalling"
              ? "撤回中"
              : "",
      isFileMessage,
      isMe: String(message.senderId) === String(auth.userId),
      canRecall: String(message.senderId) === String(auth.userId) && !deleted && !message.operationState,
      canRetry: String(message.senderId) === String(auth.userId) && message.operationState === "failed",
      canDelete: String(message.senderId) === String(auth.userId) && !deleted && !message.operationState,
      canForward: !deleted && !message.operationState && message.type === "text",
      isFavorite: favoriteMessages.value.some((item) => item.id === String(message.id)),
      timeText: formatDateTime(message.createdAt),
      html,
      files: isFileMessage
        ? message.files.map((file) => ({
            ...file,
            metaText: `${formatFileSize(file.size)} · ${(file.mimeType || "file").split("/").pop()?.toUpperCase() || "FILE"}`,
            expiryText: formatExpiry(file.expiresAt),
          }))
        : [],
      replyToText: buildReplyText(message),
      avatarUrl: resolveMediaUrl(message.sender?.profile?.avatarUrl || ""),
      avatarText: getInitials(senderName, senderName),
    };
  }));

  const showReplyBar = computed(() => Boolean(replyTo.value));
  const replyText = computed(() => {
    if (replyTo.value) {
      return `回复 ${replyTo.value.sender?.profile?.realName || replyTo.value.senderId}：${replyTo.value.content || ""}`;
    }
    return "";
  });

  const searchResultText = computed(() => (
    searchKeyword.value ? `搜索结果：${searchKeyword.value}（${messages.value.length} 条）` : ""
  ));
  const favoriteMessageIds = computed(() => favoriteMessages.value.map((item) => item.id));

  function pushNotification({ title, message = "", tone = "success", ttl = 3200 }) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    notifications.value = [...notifications.value, { id, title, message, tone }];
    if (ttl > 0) {
      window.setTimeout(() => {
        dismissNotification(id);
      }, ttl);
    }
    return id;
  }

  function dismissNotification(id) {
    notifications.value = notifications.value.filter((item) => item.id !== id);
  }

  function persistConversationPreferences() {
    const saved = saveConversationPreferences({
      mutedConversationIds: mutedConversationIds.value,
      hiddenConversationIds: hiddenConversationIds.value,
    });
    mutedConversationIds.value = saved.mutedConversationIds;
    hiddenConversationIds.value = saved.hiddenConversationIds;
  }

  function toggleConversationMuted(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return false;
    mutedConversationIds.value = mutedConversationIds.value.includes(targetId)
      ? mutedConversationIds.value.filter((item) => item !== targetId)
      : [...mutedConversationIds.value, targetId];
    persistConversationPreferences();
    return mutedConversationIds.value.includes(targetId);
  }

  function hideConversation(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return;
    hiddenConversationIds.value = hiddenConversationIds.value.includes(targetId)
      ? hiddenConversationIds.value
      : [...hiddenConversationIds.value, targetId];
    persistConversationPreferences();
  }

  function showConversation(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return;
    hiddenConversationIds.value = hiddenConversationIds.value.filter((item) => item !== targetId);
    persistConversationPreferences();
  }

  function setComposerHint(message, tone = "") {
    composerHint.value = message || "";
    composerHintTone.value = tone;
  }

  function setCreateDialogHint(message, tone = "") {
    createDialogHint.value = message || "";
    createDialogHintTone.value = tone;
  }

  function setAnnouncementHint(message, tone = "") {
    announcementHint.value = message || "";
    announcementHintTone.value = tone;
  }

  function openCreateDialog(mode) {
    createDialogMode.value = mode;
    createDialogOpen.value = true;
    createDialogTitle.value = "";
    createDialogPeerId.value = contacts.value[0]?.id || "";
    createDialogParticipantIds.value = contacts.value.map((user) => user.id).slice(0, 2);
    createDialogSubmitting.value = false;
    setCreateDialogHint("", "");
  }

  function closeCreateDialog() {
    createDialogOpen.value = false;
    createDialogSubmitting.value = false;
    setCreateDialogHint("", "");
  }

  function openAnnouncementDialog() {
    announcementDialogOpen.value = true;
    announcementSubmitting.value = false;
    announcementDraft.value = "";
    setAnnouncementHint("", "");
  }

  function closeAnnouncementDialog() {
    announcementDialogOpen.value = false;
    announcementSubmitting.value = false;
    setAnnouncementHint("", "");
  }

  function openConfirmDialog({ title, message, confirmText = "确认", action = null }) {
    confirmDialogOpen.value = true;
    confirmDialogTitle.value = title || "请确认";
    confirmDialogMessage.value = message || "确定继续吗？";
    confirmDialogConfirmText.value = confirmText;
    confirmDialogSubmitting.value = false;
    pendingConfirmAction.value = action;
  }

  function closeConfirmDialog() {
    confirmDialogOpen.value = false;
    confirmDialogSubmitting.value = false;
    pendingConfirmAction.value = null;
  }

  function toggleDialogParticipant(userId) {
    if (createDialogParticipantIds.value.includes(userId)) {
      createDialogParticipantIds.value = createDialogParticipantIds.value.filter((item) => item !== userId);
      return;
    }
    createDialogParticipantIds.value = [...createDialogParticipantIds.value, userId];
  }

  function clearReplyState() {
    replyTo.value = null;
  }

  function toggleFavoriteMessage(message) {
    const targetId = String(message?.id || "");
    if (!targetId) return;
    if (favoriteMessages.value.some((item) => item.id === targetId)) {
      favoriteMessages.value = favoriteMessages.value.filter((item) => item.id !== targetId);
    } else {
      favoriteMessages.value = [{
        id: targetId,
        conversationId: String(message.conversationId || selectedId.value || ""),
        conversationTitle: chatTitle.value || "收藏消息",
        senderName: message.sender?.profile?.realName || message.senderName || message.senderId || "未知用户",
        content: message.content || "[空消息]",
        createdAt: message.createdAt || new Date().toISOString(),
      }, ...favoriteMessages.value];
    }
    saveFavoriteMessages(favoriteMessages.value);
  }

  function removeFavoriteMessage(messageId) {
    const targetId = String(messageId || "");
    if (!targetId) return;
    favoriteMessages.value = favoriteMessages.value.filter((item) => item.id !== targetId);
    saveFavoriteMessages(favoriteMessages.value);
  }

  function openForwardDialog(messageId) {
    forwardingMessageId.value = String(messageId || "");
    forwardConversationId.value = selectedId.value || conversations.value[0]?.id || "";
    forwardHint.value = "";
    forwardSubmitting.value = false;
    forwardDialogOpen.value = true;
  }

  function closeForwardDialog() {
    forwardDialogOpen.value = false;
    forwardingMessageId.value = "";
    forwardConversationId.value = "";
    forwardHint.value = "";
    forwardSubmitting.value = false;
  }

  function collectMentionIds(content) {
    return participants.value
      .filter((user) => content.includes(`@${user.profile.realName || user.id}`))
      .map((user) => user.id);
  }

  function updateMentionState(nextValue = messageInput.value) {
    const cursor = nextValue.length;
    const head = nextValue.slice(0, cursor);
    const match = head.match(/(^|\s)@([A-Za-z0-9_\-\u4e00-\u9fa5]*)$/);
    if (!match) {
      mentionOpen.value = false;
      mentionOptions.value = [];
      return;
    }

    mentionOpen.value = true;
    mentionKeyword.value = match[2] || "";
    mentionStart.value = cursor - mentionKeyword.value.length - 1;
    mentionOptions.value = participants.value.filter((user) => {
      const name = String(user.profile?.realName || "").toLowerCase();
      return !mentionKeyword.value || name.includes(mentionKeyword.value.toLowerCase());
    });
  }

  function applyMention(userId) {
    const user = participants.value.find((item) => item.id === userId);
    if (!user) return;
    const before = messageInput.value.slice(0, mentionStart.value);
    messageInput.value = `${before}@${user.profile.realName || user.id} `;
    mentionOpen.value = false;
    mentionOptions.value = [];
  }

  function resetComposer() {
    messageInput.value = "";
    mentionOpen.value = false;
    mentionOptions.value = [];
    uploadProgress.value = 0;
    uploadFileName.value = "";
    setComposerHint("", "");
    searchKeyword.value = "";
    messageKeyword.value = "";
  }

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
    favoriteMessageIds,
    mentionOpen,
    mentionStart,
    mentionKeyword,
    mentionOptions,
    searchKeyword,
    socketOnline,
    conversationKeyword,
    messageKeyword,
    messageInput,
    uploadingFiles,
    uploadProgress,
    uploadFileName,
    downloadingFile,
    downloadProgress,
    downloadFileName,
    uploadProgressText,
    downloadProgressText,
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
    createDialogContacts,
    selectedPeerId,
    selectedParticipants,
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
    meName,
    meMeta,
    meAvatar,
    meAvatarUrl,
    selectedConversation,
    conversationRows,
    filteredConversations,
    chatTitle,
    chatSubtitle,
    renderedMessages,
    showReplyBar,
    replyText,
    searchResultText,
    pushNotification,
    dismissNotification,
    toggleConversationMuted,
    hideConversation,
    showConversation,
    setComposerHint,
    setCreateDialogHint,
    setAnnouncementHint,
    openCreateDialog,
    closeCreateDialog,
    openAnnouncementDialog,
    closeAnnouncementDialog,
    openConfirmDialog,
    closeConfirmDialog,
    toggleDialogParticipant,
    clearReplyState,
    toggleFavoriteMessage,
    removeFavoriteMessage,
    openForwardDialog,
    closeForwardDialog,
    collectMentionIds,
    updateMentionState,
    applyMention,
    resetComposer,
  };
}
