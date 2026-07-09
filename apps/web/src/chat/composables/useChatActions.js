import { chatApi } from "../../shared/api-client.js";

export function useChatActions(store) {
  function buildFileMessageContent(files) {
    if (!Array.isArray(files) || files.length === 0) return "附件";
    if (files.length === 1) return files[0].name || "附件";
    if (files.length === 2) return `${files[0].name || "附件"}、${files[1].name || "附件"}`;
    return `${files[0].name || "附件"} 等 ${files.length} 个文件`;
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
  }

  async function createDirectConversation() {
    if (!store.contacts.value.length) {
      store.setComposerHint("当前没有可发起私聊的联系人", "error");
      return;
    }
    const lines = store.contacts.value.map((user) => `${user.id} - ${user.profile.realName || user.id}`).join("\n");
    const peerId = window.prompt(`输入联系人账号发起私聊：\n${lines}`, store.contacts.value[0].id);
    if (!peerId) return;
    const payload = await chatApi.postJson("/api/v1/conversations", {
      kind: "direct",
      peerId: peerId.trim(),
    });
    store.selectedId.value = payload.data?.id || store.selectedId.value;
    await refreshAll();
  }

  async function createGroupConversation() {
    if (!store.contacts.value.length) {
      store.setComposerHint("当前没有可选联系人", "error");
      return;
    }
    const title = window.prompt("输入群聊名称");
    if (!title) return;
    const lines = store.contacts.value.map((user) => `${user.id} - ${user.profile.realName || user.id}`).join("\n");
    const raw = window.prompt(
      `输入成员账号，多个用英文逗号分隔：\n${lines}`,
      store.contacts.value.map((user) => user.id).slice(0, 2).join(","),
    );
    if (!raw) return;
    const participantIds = raw.split(",").map((value) => value.trim()).filter(Boolean);
    const payload = await chatApi.postJson("/api/v1/conversations", {
      kind: "group",
      title: title.trim(),
      participantIds,
    });
    store.selectedId.value = payload.data?.id || store.selectedId.value;
    await refreshAll();
  }

  async function searchMessages() {
    store.searchKeyword.value = store.messageKeyword.value.trim();
    await loadMessages();
  }

  async function sendAnnouncement() {
    if (!store.selectedId.value) return;
    const content = window.prompt("请输入公告内容");
    if (!content) return;
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/announcements`, { content });
    store.setComposerHint("", "");
    store.searchKeyword.value = "";
    store.messageKeyword.value = "";
    await refreshAll();
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
      store.editingMessageId.value = "";
    } else {
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages`, {
        content,
        mentions,
        replyToId: store.replyTo.value ? store.replyTo.value.id : null,
      });
      store.replyTo.value = null;
    }

    store.resetComposer();
    await refreshAll();
  }

  async function uploadFiles(fileList) {
    if (!store.selectedId.value) return;
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;

    store.uploadingFiles.value = true;
    store.setComposerHint(`正在上传 ${files.length} 个文件...`, "");

    try {
      const uploadedFiles = [];
      for (const file of files) {
        const presign = await chatApi.postJson("/api/v1/chat/files/presign-upload", {
          conversationId: store.selectedId.value,
          fileName: file.name || "attachment",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });
        const data = presign.data || {};
        await chatApi.putExternal(data.uploadUrl, file, data.headers || {
          "Content-Type": file.type || "application/octet-stream",
        });
        uploadedFiles.push({
          name: file.name || "attachment",
          objectKey: data.objectKey,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          uploadedAt: new Date().toISOString(),
        });
      }

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
        await refreshAll();
      }
    } catch (error) {
      store.setComposerHint(error?.message || "上传失败", "error");
    } finally {
      store.uploadingFiles.value = false;
    }
  }

  async function downloadFile(file) {
    if (!file?.objectKey) {
      store.setComposerHint("附件已过期或下载地址不可用", "error");
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
  }

  async function deleteMessage(messageId) {
    await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/messages/${encodeURIComponent(messageId)}`);
    await refreshAll();
  }

  async function handleMessageAction({ id, action }) {
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
    if (action === "delete") {
      try {
        await deleteMessage(message.id);
      } catch (error) {
        store.setComposerHint(error?.message || "删除失败", "error");
      }
    }
  }

  async function markSelectedConversationRead() {
    if (!store.selectedId.value || !store.messages.value.length) return;
    const lastMessage = store.messages.value[store.messages.value.length - 1];
    await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(store.selectedId.value)}/read`, {
      messageId: lastMessage.id,
    });
    await loadConversations();
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
      await refreshAll();
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
    store.me.value = {
      ...(store.me.value || {}),
      profile: {
        ...(store.me.value?.profile || {}),
        avatarUrl: payload.data?.avatarUrl || "",
      },
    };
    store.profileHint.value = "头像已上传";
    store.profileHintTone.value = "success";
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
    searchMessages,
    sendAnnouncement,
    submitComposer,
    uploadFiles,
    downloadFile,
    handleMessageAction,
    markSelectedConversationRead,
    saveProfile,
    uploadAvatar,
  };
}
