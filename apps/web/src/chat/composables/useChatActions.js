import { chatApi } from "../../shared/api-client.js";
import { appendAppLog } from "../../shared/app-log.js";
import { createChatConversationActions } from "./chat-conversation-actions.js";
import { CHAT_FILE_MAX_BYTES, validateChatFile } from "./chat-file-policy.js";
import { createChatFileTransferActions } from "./chat-file-transfer-actions.js";
import { createChatDataActions } from "./chat-data-actions.js";
import { createPendingAttachment, dedupeFileList } from "./file-attachments.js";
import {
  buildOptimisticTextMessage,
  findMessage,
  normalizeMessage,
  patchConversationLocally,
  patchMessageLocally,
  replaceMessageLocally,
  syncConversationPreview,
} from "./message-operations.js";
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

  function queueFiles(fileList, options = {}) {
    if (!store.selectedId.value) {
      store.setComposerHint("请先选择一个会话，再添加附件", "error");
      return;
    }
    const existing = new Set(store.pendingFiles.value.map((item) => (
      [item.name || "", item.size || 0, item.file?.lastModified || 0].join(":")
    )));
    const result = {
      added: [],
      duplicates: 0,
      tooLarge: 0,
      unsupportedType: 0,
      empty: 0,
      directoryLike: Number(options.directoryLike || 0),
      ignoredClipboardFiles: Number(options.ignoredClipboardFiles || 0),
    };
    dedupeFileList(fileList).forEach((file) => {
      const key = [file.name || "", file.size || 0, file.lastModified || 0].join(":");
      if (existing.has(key)) {
        result.duplicates += 1;
        return;
      }
      const validation = validateChatFile(file);
      if (!validation.ok) {
        if (validation.reason === "tooLarge") result.tooLarge += 1;
        else if (validation.reason === "unsupportedType") result.unsupportedType += 1;
        else result.empty += 1;
        return;
      }
      result.added.push(createPendingAttachment(file));
    });
    if (!result.added.length) {
      if (result.directoryLike) {
        store.setComposerHint("暂不支持拖入文件夹，请选择具体文件", "error");
        return;
      }
      if (result.tooLarge) {
        store.setComposerHint(`单个文件不能超过 ${Math.round(CHAT_FILE_MAX_BYTES / 1024 / 1024)} MB`, "error");
        return;
      }
      if (result.unsupportedType) {
        store.setComposerHint("包含暂不支持的文件类型，请重新选择", "error");
        return;
      }
      if (options.source === "paste" && result.ignoredClipboardFiles) {
        store.setComposerHint("当前只支持粘贴图片，其他剪贴板文件已忽略", "error");
        return;
      }
      if (result.duplicates) {
        store.setComposerHint("这些附件已经在待发送列表中了", "error");
      }
      return;
    }
    store.pendingFiles.value = [...store.pendingFiles.value, ...result.added];
    const hintParts = [`${store.pendingFiles.value.length} 个文件待发送`];
    if (result.duplicates) hintParts.push(`已跳过 ${result.duplicates} 个重复项`);
    if (result.directoryLike) hintParts.push(`已忽略 ${result.directoryLike} 个文件夹`);
    if (result.tooLarge) hintParts.push(`已忽略 ${result.tooLarge} 个超大文件`);
    if (result.unsupportedType) hintParts.push(`已忽略 ${result.unsupportedType} 个不支持类型`);
    if (options.source === "paste" && result.ignoredClipboardFiles) hintParts.push(`已忽略 ${result.ignoredClipboardFiles} 个非图片项`);
    store.setComposerHint(hintParts.join(" · "), "success");
  }

  async function postTextMessage(content, mentions, replyTo, optimisticMessage) {
    const payload = await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
      content,
      mentions,
      replyToId: replyTo ? replyTo.id : null,
    });
    if (payload.data) {
      const normalized = normalizeMessage(payload.data);
      replaceMessageLocally(store, optimisticMessage.id, normalized);
      syncConversationPreview(store, store.selectedId.value, normalized);
    }
  }

  const fileActions = createChatFileTransferActions({
    store,
    dataActions,
    autoReceiveQueue,
    postTextMessage,
  });

  async function submitComposer() {
    if (!store.selectedId.value) return;
    const activeConversationId = store.selectedId.value;
    const content = store.messageInput.value.trim();
    const pendingFiles = store.pendingFiles.value.slice();
    if (!content && !pendingFiles.length) return;
    const mentions = store.collectMentionIds(content);
    const replyTo = store.replyTo.value ? { ...store.replyTo.value } : null;
    if (content) {
      const optimisticMessage = buildOptimisticTextMessage(store, content, mentions, replyTo);
      store.messages.value = [...store.messages.value, optimisticMessage];
      syncConversationPreview(store, store.selectedId.value, optimisticMessage);
      appendAppLog({ level: "info", category: "message", message: "消息进入发送队列", meta: content.slice(0, 80) });
      store.clearReplyState();
      store.resetComposer();
      try {
        await postTextMessage(content, mentions, replyTo, optimisticMessage);
      } catch (error) {
        patchMessageLocally(store, optimisticMessage.id, {
          operationState: "failed",
          sendError: error?.message || "发送失败",
        });
        appendAppLog({ level: "error", category: "message", message: "消息发送失败", meta: error?.message || "" });
        throw error;
      }
    }
    if (pendingFiles.length) {
      await fileActions.uploadFiles(pendingFiles, { replyTo: content ? null : replyTo });
      if (!content) {
        store.clearReplyState();
        store.resetComposer();
      }
    }
    dataActions.saveConversationDraft(activeConversationId, "", []).catch(() => {});
    dataActions.loadConversations().catch(() => {});
    dataActions.markConversationReadIfNeeded().catch(() => {});
  }


  async function recallMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState) return;
    patchMessageLocally(store, messageId, {
      content: "",
      files: [],
      mentions: [],
      deletedAt: new Date().toISOString(),
      operationState: "recalling",
      sendError: "",
    });
    const payload = await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(messageId)}/recall`, {});
    if (payload.data) {
      const normalized = normalizeMessage(payload.data);
      replaceMessageLocally(store, messageId, normalized);
      syncConversationPreview(store, store.selectedId.value, normalized);
    }
  }

  function handleMessageAction({ id, action }) {
    const message = findMessage(store, id);
    if (!message || (message.operationState && action !== "retry")) return;
    if (action === "reply") {
      store.replyTo.value = message;
      return;
    }
    if (action === "favorite") {
      store.toggleFavoriteMessage(message);
      appendAppLog({
        level: "info",
        category: "message",
        message: message.isFavorite ? "已取消收藏消息" : "已收藏消息",
      });
      return;
    }
    if (action === "forward") {
      store.openForwardDialog(message.id);
      return;
    }
    if (action === "recall") {
      recallMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "撤回失败", "error");
        dataActions.refreshSelectedConversation().catch(() => {});
      });
      return;
    }
    if (action === "delete") {
      fileActions.deleteMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "删除失败", "error");
        dataActions.refreshSelectedConversation().catch(() => {});
      });
      return;
    }
    if (action === "retry") {
      fileActions.retryMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "重试失败", "error");
      });
    }
  }

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
    submitComposer,
    uploadFiles: fileActions.uploadFiles,
    queueFiles,
    downloadFile: fileActions.downloadFile,
    saveFileAs: fileActions.saveFileAs,
    openFile: fileActions.openFile,
    openFileLocation: fileActions.openFileLocation,
    copyImageToClipboard: fileActions.copyImageToClipboard,
    autoReceiveImages: fileActions.autoReceiveImages,
    handleMessageAction,
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
