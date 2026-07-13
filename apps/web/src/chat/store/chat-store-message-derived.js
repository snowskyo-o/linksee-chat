import { computed } from "vue";
import { resolveMediaUrl } from "../../shared/media.js";
import { formatDateTime, formatExpiry, formatFileSize, getInitials, escapeHtml } from "../../shared/utils.js";
import { getFileExtensionLabel, isImageFileLike } from "../composables/file-attachments.js";
import { buildDerivedReplyText, escapeDerivedSearchPattern, highlightMentionTokens } from "./chat-store-derived-utils.js";

function buildStatusText(operationState) {
  if (operationState === "sending") return "发送中";
  if (operationState === "failed") return "发送失败";
  if (operationState === "recalling") return "撤回中";
  return "";
}

export function createChatStoreMessageDerived(auth, state) {
  const renderedMessages = computed(() => state.messages.value.map((message) => {
    const senderName = message.sender?.profile?.realName || message.senderId || "未知用户";
    const deleted = Boolean(message.deletedAt);
    const isFileMessage = Array.isArray(message.files) && message.files.length > 0;
    let html = deleted ? "" : escapeHtml(message.content || "");
    html = highlightMentionTokens(html, state.participants.value);
    const activeSearch = state.searchKeyword.value.trim();
    if (activeSearch) {
      const pattern = new RegExp(`(${escapeDerivedSearchPattern(escapeHtml(activeSearch))})`, "gi");
      html = html.replace(pattern, '<mark class="message-search-mark">$1</mark>');
    }

    return {
      ...message,
      senderName,
      isSystemNote: deleted,
      systemText: String(message.senderId) === String(auth.userId) ? "你撤回了一条消息" : `${senderName} 撤回了一条消息`,
      operationState: message.operationState || "",
      statusText: buildStatusText(message.operationState),
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
      files: isFileMessage ? message.files.map((file) => ({
        ...file,
        isImage: isImageFileLike(file),
        expired: formatExpiry(file.expiresAt) === "已过期",
        metaText: `${formatFileSize(file.size)} · ${(file.mimeType || "file").split("/").pop()?.toUpperCase() || "FILE"}`,
        sizeText: formatFileSize(file.size),
        extensionLabel: getFileExtensionLabel(file.name, file.mimeType),
        expiryText: formatExpiry(file.expiresAt),
        transfer: state.fileTransfers.value[file.objectKey] || null,
      })) : [],
      replyToText: buildDerivedReplyText(message),
      avatarUrl: resolveMediaUrl(message.sender?.profile?.avatarUrl || ""),
      avatarText: getInitials(senderName, senderName),
    };
  }));

  return {
    renderedMessages,
    showReplyBar: computed(() => Boolean(state.replyTo.value)),
    replyText: computed(() => (
      state.replyTo.value
        ? `回复 ${state.replyTo.value.sender?.profile?.realName || state.replyTo.value.senderId}：${state.replyTo.value.content || ""}`
        : ""
    )),
    searchResultText: computed(() => (
      state.searchKeyword.value ? `搜索结果：${state.searchKeyword.value}（${state.messages.value.length} 条）` : ""
    )),
    favoriteMessageIds: computed(() => state.favoriteMessages.value.map((item) => item.id)),
  };
}
