import { appendAppLog } from "../../shared/app-log.js";

export function createChatConversationDialogActions({ store, chatApi, dataActions }) {
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

  return {
    sendAnnouncement,
    submitAnnouncement,
    submitConfirmDialog,
    submitForwardMessage,
  };
}
