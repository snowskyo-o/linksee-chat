import { appendAppLog } from "../../shared/app-log.js";
import {
  buildOptimisticTextMessage,
  normalizeMessage,
  patchMessageLocally,
  replaceMessageLocally,
  syncConversationPreview,
} from "./message-operations.js";

export async function postTextMessage(store, chatApi, content, mentions, replyTo, optimisticMessage) {
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

export function createChatComposerSubmitActions({ store, chatApi, dataActions, fileActions }) {
  async function sendTextMessage(content, mentions, replyTo, optimisticMessage) {
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
        await sendTextMessage(content, mentions, replyTo, optimisticMessage);
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

  return {
    submitComposer,
  };
}
