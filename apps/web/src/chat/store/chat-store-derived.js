import { computed } from "vue";
import { resolveMediaUrl } from "../../shared/media.js";
import { escapeHtml, formatDateTime, formatExpiry, formatFileSize, getInitials } from "../../shared/utils.js";
import { getFileExtensionLabel, isImageFileLike } from "../composables/file-attachments.js";

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
    const originalName = peer?.profile?.originalRealName || "";
    const bio = peer?.profile?.bio || "";
    if (peer?.friendAlias && originalName && originalName !== peer.friendAlias) {
      return bio ? `${originalName} · ${bio}` : originalName;
    }
    return bio || "私聊";
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

export function createChatStoreDerived(auth, state) {
  const meName = computed(() => state.me.value?.profile?.realName || auth.userId || "未登录");
  const meMeta = computed(() => state.me.value?.profile?.bio || "保持联络，保持专注");
  const meAvatar = computed(() => getInitials(meName.value, auth.userId));
  const meAvatarUrl = computed(() => resolveMediaUrl(state.me.value?.profile?.avatarUrl || ""));
  const selectedConversation = computed(() => state.conversations.value.find((item) => item.id === state.selectedId.value) || null);
  const selectedPeerId = computed(() => state.createDialogPeerId.value || state.contacts.value[0]?.id || "");
  const selectedParticipants = computed(() => state.contacts.value.filter((user) => state.createDialogParticipantIds.value.includes(user.id)));
  const createDialogContacts = computed(() => state.contacts.value.map((user) => ({
    id: user.id,
    name: user.friendAlias || user.profile?.realName || user.id,
    realName: user.profile?.originalRealName || user.profile?.realName || user.id,
    friendAlias: user.friendAlias || "",
    bio: user.profile?.bio || "",
    avatarUrl: resolveMediaUrl(user.profile?.avatarUrl || ""),
  })));
  const uploadProgressText = computed(() => {
    if (!state.uploadingFiles.value) return "";
    if (!state.uploadFileName.value) return `上传中 ${state.uploadProgress.value}%`;
    return `正在上传 ${state.uploadFileName.value} · ${state.uploadProgress.value}%`;
  });
  const downloadProgressText = computed(() => {
    if (!state.downloadingFile.value) return "";
    if (!state.downloadFileName.value) return `下载中 ${state.downloadProgress.value}%`;
    return `正在下载 ${state.downloadFileName.value} · ${state.downloadProgress.value}%`;
  });

  const conversationRows = computed(() => (
    state.conversations.value
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
          isMuted: state.mutedConversationIds.value.includes(String(row.id || "")),
          isHidden: state.hiddenConversationIds.value.includes(String(row.id || "")),
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
    const keyword = state.conversationKeyword.value.trim().toLowerCase();
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

  const renderedMessages = computed(() => state.messages.value.map((message) => {
    const senderName = message.sender?.profile?.realName || message.senderId || "未知用户";
    const deleted = Boolean(message.deletedAt);
    const isFileMessage = Array.isArray(message.files) && message.files.length > 0;
    let html = deleted ? "" : escapeHtml(message.content || "");

    state.participants.value.forEach((user) => {
      const name = user.profile?.realName || "";
      if (!name) return;
      const token = `@${name}`;
      html = html.split(escapeHtml(token)).join(`<span class="mention">${escapeHtml(token)}</span>`);
    });

    const activeSearch = state.searchKeyword.value.trim();
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
      canForward: !deleted && !message.operationState && (message.type === "text" || isFileMessage),
      hasTextContent: !deleted && !isFileMessage && Boolean(String(message.content || "").trim()),
      isFavorite: state.favoriteMessages.value.some((item) => item.id === String(message.id)),
      timeText: formatDateTime(message.createdAt),
      html,
      files: isFileMessage
        ? message.files.map((file) => ({
            ...file,
            isImage: isImageFileLike(file),
            expired: formatExpiry(file.expiresAt) === "已过期",
            metaText: `${formatFileSize(file.size)} · ${(file.mimeType || "file").split("/").pop()?.toUpperCase() || "FILE"}`,
            sizeText: formatFileSize(file.size),
            extensionLabel: getFileExtensionLabel(file.name, file.mimeType),
            expiryText: formatExpiry(file.expiresAt),
            transfer: state.fileTransfers.value[file.objectKey] || null,
          }))
        : [],
      replyToText: buildReplyText(message),
      avatarUrl: resolveMediaUrl(message.sender?.profile?.avatarUrl || ""),
      avatarText: getInitials(senderName, senderName),
    };
  }));

  const showReplyBar = computed(() => Boolean(state.replyTo.value));
  const replyText = computed(() => {
    if (state.replyTo.value) {
      return `回复 ${state.replyTo.value.sender?.profile?.realName || state.replyTo.value.senderId}：${state.replyTo.value.content || ""}`;
    }
    return "";
  });

  const searchResultText = computed(() => (
    state.searchKeyword.value ? `搜索结果：${state.searchKeyword.value}（${state.messages.value.length} 条）` : ""
  ));
  const favoriteMessageIds = computed(() => state.favoriteMessages.value.map((item) => item.id));

  return {
    chatSubtitle,
    chatTitle,
    conversationRows,
    createDialogContacts,
    downloadProgressText,
    favoriteMessageIds,
    filteredConversations,
    meAvatar,
    meAvatarUrl,
    meMeta,
    meName,
    renderedMessages,
    replyText,
    searchResultText,
    selectedConversation,
    selectedParticipants,
    selectedPeerId,
    showReplyBar,
    uploadProgressText,
  };
}
