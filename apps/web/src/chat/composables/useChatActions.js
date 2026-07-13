import { chatApi } from "../../shared/api-client.js";
import { appendAppLog } from "../../shared/app-log.js";
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

  function createDirectConversation() {
    if (!store.contacts.value.length) {
      store.setComposerHint("当前没有可发起私聊的联系人", "error");
      store.pushNotification({ title: "无法发起私聊", message: "当前没有可用联系人。", tone: "error" });
      return;
    }
    store.openCreateDialog("direct");
  }

  function createGroupConversation() {
    if (!store.contacts.value.length) {
      store.setComposerHint("当前没有可选联系人", "error");
      store.pushNotification({ title: "无法创建群聊", message: "当前没有可选成员。", tone: "error" });
      return;
    }
    store.openCreateDialog("group");
  }

  async function openOrCreateDirectConversation(peerId) {
    const targetPeerId = String(peerId || "").trim();
    if (!targetPeerId) return "";
    const payload = await chatApi.postJson("/api/v1/conversations", {
      kind: "direct",
      peerId: targetPeerId,
    });
    const conversationId = String(payload.data?.id || "");
    if (!conversationId) return "";
    store.selectedId.value = conversationId;
    await dataActions.loadConversations();
    await selectConversation(conversationId);
    return conversationId;
  }

  async function selectConversation(conversationId) {
    await dataActions.selectConversation(conversationId);
    await profileActions.refreshProfilesIfDirty(store.participants.value.map((user) => user.id)).catch(() => {});
  }

  async function submitCreateConversation() {
    store.createDialogSubmitting.value = true;
    store.setCreateDialogHint("", "");
    try {
      if (store.createDialogMode.value === "direct") {
        const peerId = store.selectedPeerId.value.trim();
        if (!peerId) {
          store.setCreateDialogHint("请选择一个联系人", "error");
          return;
        }
        const payload = await chatApi.postJson("/api/v1/conversations", { kind: "direct", peerId });
        store.selectedId.value = payload.data?.id || store.selectedId.value;
      store.pushNotification({ title: "私聊已创建", message: "可以开始发送消息了。", tone: "success" });
      appendAppLog({ level: "info", category: "conversation", message: `已创建私聊：${peerId}` });
      } else {
        const title = store.createDialogTitle.value.trim();
        if (!title) {
          store.setCreateDialogHint("请输入群聊名称", "error");
          return;
        }
        if (store.createDialogParticipantIds.value.length < 2) {
          store.setCreateDialogHint("至少选择两位成员", "error");
          return;
        }
        const payload = await chatApi.postJson("/api/v1/conversations", {
          kind: "group",
          title,
          participantIds: store.createDialogParticipantIds.value,
        });
        store.selectedId.value = payload.data?.id || store.selectedId.value;
        store.pushNotification({ title: "群聊已创建", message: `“${title}” 已准备就绪。`, tone: "success" });
        appendAppLog({ level: "info", category: "conversation", message: `已创建群聊：${title}` });
      }
      store.closeCreateDialog();
      await dataActions.refreshAll();
    } catch (error) {
      store.setCreateDialogHint(error?.message || "创建会话失败", "error");
      store.pushNotification({ title: "创建失败", message: error?.message || "创建会话失败", tone: "error" });
    } finally {
      store.createDialogSubmitting.value = false;
    }
  }

  function sendAnnouncement() {
    if (store.selectedId.value) store.openAnnouncementDialog();
  }

  async function submitAnnouncement() {
    if (!store.selectedId.value) return;
    const content = store.announcementDraft.value.trim();
    if (!content) {
      store.setAnnouncementHint("请输入公告内容", "error");
      return;
    }
    store.announcementSubmitting.value = true;
    store.setAnnouncementHint("", "");
    try {
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/announcements`, { content });
      store.closeAnnouncementDialog();
      store.setComposerHint("公告已发布", "success");
      store.searchKeyword.value = "";
      store.messageKeyword.value = "";
      await dataActions.refreshAll();
    } catch (error) {
      store.setAnnouncementHint(error?.message || "发布公告失败", "error");
    } finally {
      store.announcementSubmitting.value = false;
    }
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

  async function submitForwardMessage() {
    const message = findMessage(store, store.forwardingMessageId.value);
    const targetConversationId = String(store.forwardConversationId.value || "");
    if (!message) {
      store.forwardHint.value = "转发消息不存在";
      return;
    }
    if (!targetConversationId) {
      store.forwardHint.value = "请选择一个目标会话";
      return;
    }
    if (!message.canForward) {
      store.forwardHint.value = "当前消息暂不支持转发";
      return;
    }

    store.forwardSubmitting.value = true;
    store.forwardHint.value = "";
    try {
      if (Array.isArray(message.files) && message.files.length) {
        await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(targetConversationId)}/messages/forward`, {
          sourceConversationId: String(message.conversationId || store.selectedId.value || ""),
          sourceMessageId: String(message.id || ""),
        });
      } else {
        await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(targetConversationId)}/messages`, {
          content: message.content || "",
          mentions: [],
          replyToId: null,
        });
      }
      store.closeForwardDialog();
      store.pushNotification({ title: "转发成功", message: "消息已发送到目标会话", tone: "success" });
      appendAppLog({ level: "info", category: "message", message: `消息已转发到会话 ${targetConversationId}` });
      await dataActions.loadConversations();
    } catch (error) {
      store.forwardHint.value = error?.message || "转发失败";
      appendAppLog({ level: "error", category: "message", message: "消息转发失败", meta: error?.message || "" });
    } finally {
      store.forwardSubmitting.value = false;
    }
  }

  async function submitConfirmDialog() {
    if (typeof store.pendingConfirmAction.value !== "function") return;
    store.confirmDialogSubmitting.value = true;
    try {
      await store.pendingConfirmAction.value();
      store.closeConfirmDialog();
    } finally {
      store.confirmDialogSubmitting.value = false;
    }
  }

  async function toggleConversationPin() {
    const selected = store.selectedConversation.value;
    if (!selected?.id) return;
    if (selected.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`);
      patchConversationLocally(store, selected.id, { pinnedAt: null });
      store.setComposerHint("已取消置顶", "success");
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`, {});
    patchConversationLocally(store, selected.id, { pinnedAt: new Date().toISOString() });
    store.setComposerHint("已置顶会话", "success");
  }

  async function toggleConversationPinById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    if (!target) return;
    if (target.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`);
      patchConversationLocally(store, conversationId, { pinnedAt: null });
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`, {});
    patchConversationLocally(store, conversationId, { pinnedAt: new Date().toISOString() });
  }

  async function markConversationReadById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    const lastMessageId = target?.lastMessage?.id ? String(target.lastMessage.id) : "";
    if (!target?.id || !lastMessageId) return;
    if (!target.unreadCount && !target.unreadMentionCount) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(target.id)}/read`, {
      messageId: lastMessageId,
    });
    patchConversationLocally(store, target.id, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
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
    selectConversation,
    createDirectConversation,
    createGroupConversation,
    openOrCreateDirectConversation,
    submitCreateConversation,
    searchMessages: dataActions.searchMessages,
    sendAnnouncement,
    submitAnnouncement,
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
    submitForwardMessage,
    submitConfirmDialog,
    toggleConversationPin,
    toggleConversationPinById,
    markConversationReadById,
    saveProfile: profileActions.saveProfile,
    uploadAvatar: profileActions.uploadAvatar,
    applyUserProfileUpdate: profileActions.applyUserProfileUpdate,
    markProfileDirty: profileActions.markProfileDirty,
    refreshProfilesIfDirty: profileActions.refreshProfilesIfDirty,
  };
}
