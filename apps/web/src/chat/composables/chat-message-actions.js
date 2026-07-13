import { findMessage, normalizeMessage, patchMessageLocally, replaceMessageLocally, syncConversationPreview } from "./message-operations.js";

export function createChatMessageActions({ store, chatApi, dataActions, fileActions }) {
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
    if (!message || (message.operationState && !["retry", "delete"].includes(action))) return;
    if (action === "reply") {
      store.replyTo.value = message;
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
    handleMessageAction,
    recallMessage,
  };
}
