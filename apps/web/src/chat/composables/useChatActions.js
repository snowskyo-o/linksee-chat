import { chatApi } from "../../shared/api-client.js";
import { appendAppLog } from "../../shared/app-log.js";
import { appendCacheBust } from "../../shared/media.js";
import { createChatDataActions } from "./chat-data-actions.js";
import { writeChatCache } from "./local-chat-cache.js";
import {
  buildFileMessageContent,
  buildOptimisticTextMessage,
  findMessage,
  normalizeMessage,
  normalizeUser,
  patchConversationLocally,
  patchMessageLocally,
  patchUserProfileLocally,
  replaceMessageLocally,
  syncConversationPreview,
} from "./message-operations.js";

export function useChatActions(store) {
  const dataActions = createChatDataActions(store, chatApi);
  const cacheUserId = () => store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";

  function persistSidebarCaches() {
    const userId = cacheUserId();
    writeChatCache(userId, "profile", {
      data: store.me.value || {},
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    writeChatCache(userId, "contacts", {
      data: store.contacts.value || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    writeChatCache(userId, "conversations", {
      data: store.conversations.value || [],
      cachedAt: new Date().toISOString(),
    }).catch(() => {});
    if (store.selectedId.value) {
      writeChatCache(userId, `participants-${store.selectedId.value}`, {
        data: store.participants.value || [],
        cachedAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  function syncCurrentUserProfileLocally(profilePatch) {
    const targetUserId = store.me.value?.id || localStorage.getItem("chat_user_id") || "";
    if (!targetUserId) return;
    applyUserProfileUpdate(targetUserId, profilePatch);
  }

  function applyUserProfileUpdate(userId, profilePatch) {
    const targetUserId = String(userId || "");
    if (!targetUserId) return;
    patchUserProfileLocally(store, targetUserId, profilePatch);
    if (store.me.value) store.me.value = normalizeUser(store.me.value);
    store.contacts.value = store.contacts.value.map((user) => normalizeUser(user));
    store.participants.value = store.participants.value.map((user) => normalizeUser(user));
    if (String(store.me.value?.id || "") === targetUserId) {
      store.profileName.value = store.me.value?.profile?.realName || store.profileName.value;
      store.profileBio.value = store.me.value?.profile?.bio || "";
      document.title = `Linksee Chat · ${store.profileName.value}`;
    }
    persistSidebarCaches();
  }

  function dedupeFiles(fileList) {
    const seen = new Set();
    const unique = [];
    for (const file of Array.from(fileList || []).filter(Boolean)) {
      const key = [file.name || "", file.size || 0, file.lastModified || 0].join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(file);
    }
    return unique;
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
    await dataActions.selectConversation(conversationId);
    return conversationId;
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

  async function submitComposer() {
    if (!store.selectedId.value) return;
    const content = store.messageInput.value.trim();
    if (!content) return;
    const mentions = store.collectMentionIds(content);
    const replyTo = store.replyTo.value ? { ...store.replyTo.value } : null;
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
    dataActions.loadConversations().catch(() => {});
    dataActions.markConversationReadIfNeeded().catch(() => {});
  }

  async function retryMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState !== "failed") return;
    patchMessageLocally(store, messageId, { operationState: "sending", sendError: "" });
    try {
      await postTextMessage(message.content || "", message.mentions || [], message.replyTo || null, message);
      appendAppLog({ level: "info", category: "message", message: "消息重试发送成功", meta: (message.content || "").slice(0, 80) });
    } catch (error) {
      patchMessageLocally(store, messageId, {
        operationState: "failed",
        sendError: error?.message || "发送失败",
      });
      appendAppLog({ level: "error", category: "message", message: "消息重试失败", meta: error?.message || "" });
      throw error;
    }
  }

  async function uploadFiles(fileList) {
    if (!store.selectedId.value) return;
    const files = dedupeFiles(fileList);
    if (!files.length) return;
    store.uploadingFiles.value = true;
    store.uploadProgress.value = 0;
    store.uploadFileName.value = files[0]?.name || "";
    store.setComposerHint(`正在上传 ${files.length} 个文件...`, "");
    appendAppLog({ level: "info", category: "file", message: `开始上传 ${files.length} 个文件` });
    try {
      const uploadedFiles = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        store.uploadFileName.value = file.name || `file-${index + 1}`;
        const base = Math.floor((index / files.length) * 100);
        const updateProgress = ({ percent }) => {
          const scaled = Math.min(100, Math.floor(((index + percent / 100) / files.length) * 100));
          store.uploadProgress.value = Math.max(base, scaled);
        };
        try {
          const presign = await chatApi.postJson("/api/v1/chat/files/presign-upload", {
            conversationId: store.selectedId.value,
            fileName: file.name || "attachment",
            mimeType: file.type || "application/octet-stream",
            size: file.size,
          });
          const data = presign.data || {};
          await chatApi.putExternal(
            data.uploadUrl,
            file,
            data.headers || { "Content-Type": file.type || "application/octet-stream" },
            updateProgress,
          );
          uploadedFiles.push({
            name: file.name || "attachment",
            objectKey: data.objectKey,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
            uploadedAt: new Date().toISOString(),
          });
        } catch (error) {
          appendAppLog({ level: "warn", category: "file", message: "预签名上传失败，切换到服务端直传", meta: error?.message || "" });
          const payload = await chatApi.postBinary("/api/v1/chat/files/upload-direct", file, {
            "Content-Type": file.type || "application/octet-stream",
            "X-Conversation-Id": store.selectedId.value,
            "X-File-Name": encodeURIComponent(file.name || "attachment"),
            "X-File-Size": String(file.size || 0),
          });
          updateProgress({ percent: 100 });
          uploadedFiles.push(payload.data || {
            name: file.name || "attachment",
            size: file.size,
            mimeType: file.type || "application/octet-stream",
          });
        }
      }
      store.uploadProgress.value = 100;
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
        type: "file",
        content: buildFileMessageContent(uploadedFiles),
        files: uploadedFiles,
        mentions: [],
        replyToId: store.replyTo.value ? store.replyTo.value.id : null,
      });
      store.clearReplyState();
      store.setComposerHint(`已上传 ${uploadedFiles.length} 个文件`, "success");
      appendAppLog({ level: "info", category: "file", message: `上传完成 ${uploadedFiles.length} 个文件` });
      await dataActions.refreshSelectedConversation();
      await dataActions.loadConversations();
      await dataActions.markConversationReadIfNeeded().catch(() => {});
    } catch (error) {
      store.setComposerHint(error?.message || "上传失败", "error");
      appendAppLog({ level: "error", category: "file", message: "文件上传失败", meta: error?.message || "" });
      throw error;
    } finally {
      store.uploadingFiles.value = false;
      store.uploadProgress.value = 0;
      store.uploadFileName.value = "";
    }
  }

  async function downloadFile(file) {
    if (!file?.objectKey) {
      store.setComposerHint("附件已过期或下载地址不可用", "error");
      return;
    }
    store.downloadingFile.value = true;
    store.downloadProgress.value = 0;
    store.downloadFileName.value = file.name || "attachment";
    try {
      const blob = await chatApi.getBlobWithProgress(
        `/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`,
        ({ percent }) => {
          store.downloadProgress.value = percent;
        },
      );
      store.downloadProgress.value = 100;
      if (window.desktopShell?.isDesktop && typeof window.desktopShell?.saveDownloadedFile === "function") {
        const saved = await window.desktopShell.saveDownloadedFile({
          fileName: file.name || "attachment",
          bytes: Array.from(new Uint8Array(await blob.arrayBuffer())),
          conversationId: store.selectedId.value || "shared",
          cacheKey: file.objectKey,
        });
        store.pushNotification({
          title: "已保存到本地",
          message: saved?.exportPath || file.name || "附件",
          tone: "success",
          ttl: 2600,
        });
      } else {
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = file.name || "attachment";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
        store.pushNotification({ title: "开始下载", message: file.name || "附件", tone: "success", ttl: 2200 });
      }
      appendAppLog({ level: "info", category: "file", message: `开始下载 ${file.name || "附件"}` });
    } finally {
      window.setTimeout(() => {
        store.downloadingFile.value = false;
        store.downloadProgress.value = 0;
        store.downloadFileName.value = "";
      }, 600);
    }
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

  async function deleteMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || message.operationState) return;
    patchMessageLocally(store, messageId, { operationState: "recalling", sendError: "" });
    try {
      const payload = await chatApi.delete(
        `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(messageId)}`,
      );
      if (payload.data) {
        const normalized = normalizeMessage(payload.data);
        replaceMessageLocally(store, messageId, normalized);
        syncConversationPreview(store, store.selectedId.value, normalized);
        appendAppLog({ level: "info", category: "message", message: "消息已删除" });
      }
    } catch (error) {
      patchMessageLocally(store, messageId, { operationState: "", sendError: "" });
      throw error;
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
      store.forwardHint.value = "当前仅支持转发文本消息";
      return;
    }

    store.forwardSubmitting.value = true;
    store.forwardHint.value = "";
    try {
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(targetConversationId)}/messages`, {
        content: message.content || "",
        mentions: [],
        replyToId: null,
      });
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
      deleteMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "删除失败", "error");
        dataActions.refreshSelectedConversation().catch(() => {});
      });
      return;
    }
    if (action === "retry") {
      retryMessage(message.id).catch((error) => {
        store.setComposerHint(error?.message || "重试失败", "error");
      });
    }
  }

  async function saveProfile() {
    try {
      const payload = await chatApi.patchJson("/api/v1/users/me/profile", {
        realName: store.profileName.value.trim(),
        bio: store.profileBio.value.trim(),
      });
      syncCurrentUserProfileLocally({
        realName: payload.data?.realName || store.profileName.value.trim(),
        originalRealName: payload.data?.originalRealName || payload.data?.realName || store.profileName.value.trim(),
        bio: payload.data?.bio ?? store.profileBio.value.trim(),
      });
      store.profileHint.value = "资料已保存";
      store.profileHintTone.value = "success";
      document.title = `Linksee Chat · ${store.profileName.value}`;
      Promise.allSettled([
        dataActions.loadContacts(),
        dataActions.loadConversations(),
        dataActions.loadParticipants(),
      ]).then(() => {
        persistSidebarCaches();
      });
    } catch (error) {
      store.profileHint.value = error?.message || "保存失败";
      store.profileHintTone.value = "error";
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const payload = await chatApi.postBinary("/api/v1/users/me/avatar", file, {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "avatar"),
    });
    const refreshedUrl = appendCacheBust(payload.data?.avatarUrl || "", Date.now());
    syncCurrentUserProfileLocally({
      avatarUrl: refreshedUrl,
    });
    store.profileHint.value = "头像已上传";
    store.profileHintTone.value = "success";
    Promise.allSettled([
      dataActions.loadProfile({ userId: store.me.value?.id || localStorage.getItem("chat_user_id") || "" }),
      dataActions.loadContacts(),
      dataActions.loadConversations(),
      dataActions.loadParticipants(),
    ]).then(() => {
      syncCurrentUserProfileLocally({
        avatarUrl: refreshedUrl,
      });
    });
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
    selectConversation: dataActions.selectConversation,
    createDirectConversation,
    createGroupConversation,
    openOrCreateDirectConversation,
    submitCreateConversation,
    searchMessages: dataActions.searchMessages,
    sendAnnouncement,
    submitAnnouncement,
    submitComposer,
    uploadFiles,
    downloadFile,
    handleMessageAction,
    submitForwardMessage,
    submitConfirmDialog,
    toggleConversationPin,
    toggleConversationPinById,
    saveProfile,
    uploadAvatar,
    applyUserProfileUpdate,
  };
}
