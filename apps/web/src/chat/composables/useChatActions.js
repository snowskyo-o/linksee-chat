import { chatApi } from "../../shared/api-client.js";

export function useChatActions(store) {
  function buildOptimisticTextMessage(content, mentions = []) {
    const now = new Date().toISOString();
    const me = store.me.value || {};
    return {
      id: `local-${Date.now()}`,
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
      replyTo: store.replyTo.value || null,
    };
  }

  function syncConversationPreview(conversationId, messageLike) {
    patchConversationLocally(conversationId, (item) => ({
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

  function buildFileMessageContent(files) {
    if (!Array.isArray(files) || files.length === 0) return "附件";
    if (files.length === 1) return files[0].name || "附件";
    if (files.length === 2) return `${files[0].name || "附件"}、${files[1].name || "附件"}`;
    return `${files[0].name || "附件"} 等 ${files.length} 个文件`;
  }

  function patchConversationLocally(conversationId, patch) {
    store.conversations.value = store.conversations.value.map((item) => (
      String(item.id) === String(conversationId)
        ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) }
        : item
    ));
  }

  async function loadProfile(auth) {
    const payload = await chatApi.getJson("/api/v1/users/me");
    store.me.value = payload.data || {};
    store.profileName.value = store.me.value.profile?.realName || auth.userId;
    store.profileBio.value = store.me.value.profile?.bio || "";
    document.title = `Linksee Chat · ${store.profileName.value}`;
  }

  async function loadContacts() {
    const payload = await chatApi.getJson("/api/v1/contacts");
    store.contacts.value = Array.isArray(payload.data) ? payload.data : [];
  }

  async function loadConversations() {
    const payload = await chatApi.getJson("/api/v1/conversations");
    store.conversations.value = Array.isArray(payload.data) ? payload.data : [];
    if (!store.selectedId.value && store.conversations.value.length) {
      store.selectedId.value = store.conversations.value[0].id;
    }
    if (store.selectedId.value && !store.conversations.value.find((item) => item.id === store.selectedId.value)) {
      store.selectedId.value = store.conversations.value[0]?.id || "";
    }
  }

  async function loadParticipants() {
    if (!store.selectedId.value) {
      store.participants.value = [];
      return;
    }
    const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/participants`);
    store.participants.value = Array.isArray(payload.data) ? payload.data : [];
  }

  async function loadMessages() {
    if (!store.selectedId.value) {
      store.messages.value = [];
      store.hasMoreMessages.value = false;
      return;
    }
    if (store.searchKeyword.value) {
      const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/search?q=${encodeURIComponent(store.searchKeyword.value)}`);
      store.messages.value = Array.isArray(payload.data) ? payload.data : [];
      store.hasMoreMessages.value = false;
      return;
    }
    const payload = await chatApi.getJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?limit=50`);
    store.messages.value = Array.isArray(payload.data) ? payload.data : [];
    store.hasMoreMessages.value = store.messages.value.length >= 50;
  }

  async function loadOlderMessages() {
    if (!store.selectedId.value || store.searchKeyword.value || !store.messages.value.length) return;
    const oldest = store.messages.value[0];
    if (!oldest?.id) return;
    store.loadingMoreMessages.value = true;
    try {
      const payload = await chatApi.getJson(
        `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages?beforeId=${encodeURIComponent(oldest.id)}&limit=50`,
      );
      const older = Array.isArray(payload.data) ? payload.data : [];
      store.messages.value = [...older, ...store.messages.value];
      store.hasMoreMessages.value = older.length >= 50;
    } finally {
      store.loadingMoreMessages.value = false;
    }
  }

  async function markConversationReadIfNeeded() {
    const selected = store.selectedConversation.value;
    const lastMessage = store.messages.value[store.messages.value.length - 1];
    if (!selected || !lastMessage?.id) return;
    if (!selected.unreadCount && !selected.unreadMentionCount) return;

    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/read`, {
      messageId: lastMessage.id,
    });
    patchConversationLocally(selected.id, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
  }

  async function refreshSelectedConversation() {
    await loadParticipants();
    await loadMessages();
  }

  async function refreshAll() {
    await loadContacts();
    await loadConversations();
    await refreshSelectedConversation();
  }

  async function selectConversation(id) {
    store.selectedId.value = id;
    store.searchKeyword.value = "";
    store.messageKeyword.value = "";
    store.clearReplyState();
    await refreshSelectedConversation();
    await markConversationReadIfNeeded().catch(() => {});
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
        const payload = await chatApi.postJson("/api/v1/conversations", {
          kind: "direct",
          peerId,
        });
        store.selectedId.value = payload.data?.id || store.selectedId.value;
        store.pushNotification({ title: "私聊已创建", message: "可以开始发送消息了。", tone: "success" });
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
      }

      store.closeCreateDialog();
      await refreshAll();
    } catch (error) {
      store.setCreateDialogHint(error?.message || "创建会话失败", "error");
      store.pushNotification({ title: "创建失败", message: error?.message || "创建会话失败", tone: "error" });
    } finally {
      store.createDialogSubmitting.value = false;
    }
  }

  async function searchMessages() {
    store.searchKeyword.value = store.messageKeyword.value.trim();
    await loadMessages();
  }

  function sendAnnouncement() {
    if (!store.selectedId.value) return;
    store.openAnnouncementDialog();
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
      store.pushNotification({ title: "公告已发布", message: "会话成员将看到最新公告。", tone: "success" });
      store.searchKeyword.value = "";
      store.messageKeyword.value = "";
      await refreshAll();
    } catch (error) {
      store.setAnnouncementHint(error?.message || "发布公告失败", "error");
      store.pushNotification({ title: "公告发布失败", message: error?.message || "请稍后重试", tone: "error" });
    } finally {
      store.announcementSubmitting.value = false;
    }
  }

  async function submitComposer() {
    if (!store.selectedId.value) return;
    const content = store.messageInput.value.trim();
    if (!content) return;

    const mentions = store.collectMentionIds(content);
    if (store.editingMessageId.value) {
      await chatApi.patchJson(
        `/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(store.editingMessageId.value)}`,
        { content, mentions },
      );
      store.messages.value = store.messages.value.map((item) => (
        String(item.id) === String(store.editingMessageId.value)
          ? { ...item, content, mentions, editedAt: new Date().toISOString() }
          : item
      ));
      syncConversationPreview(store.selectedId.value, {
        content,
        type: "text",
        createdAt: new Date().toISOString(),
      });
      store.editingMessageId.value = "";
      store.pushNotification({ title: "消息已更新", message: "刚才的内容已经替换。", tone: "success" });
    } else {
      const optimisticMessage = buildOptimisticTextMessage(content, mentions);
      store.messages.value = [...store.messages.value, optimisticMessage];
      syncConversationPreview(store.selectedId.value, optimisticMessage);
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
        content,
        mentions,
        replyToId: store.replyTo.value ? store.replyTo.value.id : null,
      });
      store.replyTo.value = null;
    }

    store.resetComposer();
    loadConversations().catch(() => {});
    loadMessages().catch(() => {});
    markConversationReadIfNeeded().catch(() => {});
  }

  async function uploadFiles(fileList) {
    if (!store.selectedId.value) return;
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    store.uploadingFiles.value = true;
    store.uploadProgress.value = 0;
    store.uploadFileName.value = files[0]?.name || "";
    store.setComposerHint(`正在上传 ${files.length} 个文件...`, "");

    try {
      const uploadedFiles = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        store.uploadFileName.value = file.name || `file-${index + 1}`;
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
          ({ percent }) => {
            const base = Math.floor((index / files.length) * 100);
            const scaled = Math.min(100, Math.floor(((index + percent / 100) / files.length) * 100));
            store.uploadProgress.value = Math.max(base, scaled);
          },
        );
        uploadedFiles.push({
          name: file.name || "attachment",
          objectKey: data.objectKey,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
        });
      }

      store.uploadProgress.value = 100;
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
        type: "file",
        content: buildFileMessageContent(uploadedFiles),
        files: uploadedFiles,
        mentions: [],
        replyToId: store.replyTo.value ? store.replyTo.value.id : null,
      });

      if (uploadedFiles.length > 0) {
        store.clearReplyState();
        store.setComposerHint(`已上传 ${uploadedFiles.length} 个文件`, "success");
        store.pushNotification({ title: "文件已发送", message: `成功上传 ${uploadedFiles.length} 个文件。`, tone: "success" });
        await refreshAll();
        await markConversationReadIfNeeded().catch(() => {});
      }
    } catch (error) {
      store.setComposerHint(error?.message || "上传失败", "error");
      store.pushNotification({ title: "上传失败", message: error?.message || "请稍后重试", tone: "error" });
    } finally {
      store.uploadingFiles.value = false;
      store.uploadProgress.value = 0;
      store.uploadFileName.value = "";
    }
  }

  async function downloadFile(file) {
    if (!file?.objectKey) {
      store.setComposerHint("附件已过期或下载地址不可用", "error");
      store.pushNotification({ title: "无法下载", message: "附件已过期或不可用。", tone: "error" });
      return;
    }
    const response = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(file.objectKey)}`);
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = file.name || "attachment";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      window.URL.revokeObjectURL(objectUrl);
    }, 1000);
    store.pushNotification({ title: "开始下载", message: file.name || "附件", tone: "success", ttl: 2200 });
  }

  async function recallMessage(messageId) {
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(messageId)}/recall`, {});
    await refreshAll();
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
      patchConversationLocally(selected.id, { pinnedAt: null });
      store.setComposerHint("已取消置顶", "success");
      store.pushNotification({ title: "已取消置顶", message: "该会话恢复普通排序。", tone: "success" });
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(selected.id)}/pin`, {});
    patchConversationLocally(selected.id, { pinnedAt: new Date().toISOString() });
    store.setComposerHint("已置顶会话", "success");
    store.pushNotification({ title: "会话已置顶", message: "这个会话会固定显示在前面。", tone: "success" });
  }

  async function toggleConversationPinById(conversationId) {
    const target = store.conversations.value.find((item) => String(item.id) === String(conversationId));
    if (!target) return;
    if (target.pinnedAt) {
      await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`);
      patchConversationLocally(conversationId, { pinnedAt: null });
      return;
    }
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/pin`, {});
    patchConversationLocally(conversationId, { pinnedAt: new Date().toISOString() });
  }

  function handleMessageAction({ id, action }) {
    const message = store.messages.value.find((item) => String(item.id) === String(id));
    if (!message) return;
    if (action === "reply") {
      store.replyTo.value = message;
      store.editingMessageId.value = "";
      return;
    }
    if (action === "edit") {
      store.replyTo.value = null;
      store.editingMessageId.value = message.id;
      store.messageInput.value = message.content || "";
      return;
    }
    if (action === "recall") {
      store.openConfirmDialog({
        title: "撤回消息",
        message: "撤回后，这条消息会在当前会话中显示为已撤回。",
        confirmText: "确认撤回",
        action: async () => {
          try {
            await recallMessage(message.id);
            store.pushNotification({ title: "消息已撤回", message: "这条内容已从会话中收回。", tone: "success" });
          } catch (error) {
            store.setComposerHint(error?.message || "撤回失败", "error");
            store.pushNotification({ title: "撤回失败", message: error?.message || "请稍后重试", tone: "error" });
          }
        },
      });
    }
  }

  async function markSelectedConversationRead() {
    if (!store.selectedId.value || !store.messages.value.length) return;
    const lastMessage = store.messages.value[store.messages.value.length - 1];
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/read`, {
      messageId: lastMessage.id,
    });
    patchConversationLocally(store.selectedId.value, {
      unreadCount: 0,
      unreadMentionCount: 0,
      lastReadAt: new Date().toISOString(),
    });
    store.pushNotification({ title: "已标记已读", message: "当前会话未读状态已清除。", tone: "success", ttl: 2200 });
  }

  async function saveProfile() {
    try {
      const payload = await chatApi.patchJson("/api/v1/users/me/profile", {
        realName: store.profileName.value.trim(),
        bio: store.profileBio.value.trim(),
      });
      store.profileName.value = payload.data.realName || store.profileName.value.trim();
      store.profileHint.value = "资料已保存";
      store.profileHintTone.value = "success";
      store.pushNotification({ title: "资料已保存", message: "新的昵称和签名已经生效。", tone: "success" });
      await refreshAll();
    } catch (error) {
      store.profileHint.value = error?.message || "保存失败";
      store.profileHintTone.value = "error";
      store.pushNotification({ title: "保存失败", message: error?.message || "请稍后重试", tone: "error" });
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const payload = await chatApi.postBinary("/api/v1/users/me/avatar", file, {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name || "avatar"),
    });
    store.me.value = {
      ...(store.me.value || {}),
      profile: {
        ...(store.me.value?.profile || {}),
        avatarUrl: payload.data?.avatarUrl || "",
      },
    };
    store.profileHint.value = "头像已上传";
    store.profileHintTone.value = "success";
    store.pushNotification({ title: "头像已更新", message: "新的头像已经显示在客户端中。", tone: "success" });
    await refreshAll();
  }

  return {
    loadProfile,
    loadContacts,
    loadConversations,
    loadParticipants,
    loadMessages,
    loadOlderMessages,
    refreshSelectedConversation,
    refreshAll,
    selectConversation,
    createDirectConversation,
    createGroupConversation,
    submitCreateConversation,
    searchMessages,
    sendAnnouncement,
    submitAnnouncement,
    submitComposer,
    uploadFiles,
    downloadFile,
    handleMessageAction,
    submitConfirmDialog,
    markSelectedConversationRead,
    toggleConversationPin,
    toggleConversationPinById,
    saveProfile,
    uploadAvatar,
  };
}
