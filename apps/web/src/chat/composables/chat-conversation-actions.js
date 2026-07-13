import { appendAppLog } from "../../shared/app-log.js";

export function createChatConversationActions({
  store,
  chatApi,
  dataActions,
  profileActions,
  patchConversationLocally,
}) {
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

  async function submitForwardMessage() {
    const message = store.messages.value.find((item) => String(item.id) === String(store.forwardingMessageId.value));
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

  return {
    createDirectConversation,
    createGroupConversation,
    markConversationReadById,
    openOrCreateDirectConversation,
    selectConversation,
    sendAnnouncement,
    submitAnnouncement,
    submitConfirmDialog,
    submitCreateConversation,
    submitForwardMessage,
    toggleConversationPin,
    toggleConversationPinById,
  };
}
