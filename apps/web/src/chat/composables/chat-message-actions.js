import { findMessage, normalizeMessage, patchMessageLocally, replaceMessageLocally, syncConversationPreview } from "./message-operations.js";
import { isMessageActionAvailable } from "./chat-message-action-rules.js";

export function createChatMessageActions({ store, chatApi, dataActions, fileActions }) {
  async function copyMessage(message) {
    const text = String(message?.content || "").trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      store.pushNotification({ title: "已复制", message: "消息内容已复制", tone: "success", ttl: 1600 });
    } catch (error) {
      store.pushNotification({ title: "复制失败", message: error?.message || "当前环境不支持剪贴板", tone: "error" });
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

  function handleMessageAction({ id, action }) {
    const message = findMessage(store, id);
    if (!isMessageActionAvailable(message, action)) return;
    if (action === "reply") {
      store.replyTo.value = message;
      return;
    }
    if (action === "copy") {
      copyMessage(message).catch(() => {});
      return;
    }
    if (action === "favorite") {
      store.toggleFavoriteMessage(message);
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
    copyMessage,
    handleMessageAction,
    recallMessage,
  };
}
