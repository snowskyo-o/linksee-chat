import { appendAppLog } from "../../shared/app-log.js";
import { createChatFileDownloadActions } from "./chat-file-download-actions.js";
import { createChatFileUploadActions } from "./chat-file-upload-actions.js";
import {
  findMessage,
  patchConversationLocally,
  patchMessageLocally,
  removeMessageLocally,
} from "./message-operations.js";
import { pickVisibleConversationPreview, rememberLocallyDeletedMessage } from "./message-visibility-cache.js";

export function createChatFileTransferActions({ store, dataActions, autoReceiveQueue, postTextMessage }) {
  const { uploadFiles } = createChatFileUploadActions({ store, dataActions });
  const {
    autoReceiveImages,
    copyImageToClipboard,
    downloadFile,
    openFile,
    openFileLocation,
    saveFileAs,
  } = createChatFileDownloadActions({ store, autoReceiveQueue });

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

  async function deleteMessage(messageId) {
    const message = findMessage(store, messageId);
    if (!message || (message.operationState && message.operationState !== "failed")) return;
    const userId = store.me.value?.id || localStorage.getItem("chat_user_id") || "guest";
    const fallbackPreview = pickVisibleConversationPreview(store.messages.value, messageId);
    rememberLocallyDeletedMessage(userId, store.selectedId.value, messageId, fallbackPreview);
    removeMessageLocally(store, messageId);
    patchConversationLocally(store, store.selectedId.value, {
      lastMessage: fallbackPreview,
      updatedAt: fallbackPreview?.createdAt || new Date().toISOString(),
    });
    appendAppLog({ level: "info", category: "message", message: "消息已从当前账号删除" });
  }

  return {
    autoReceiveImages,
    copyImageToClipboard,
    deleteMessage,
    downloadFile,
    openFile,
    openFileLocation,
    retryMessage,
    saveFileAs,
    uploadFiles,
  };
}
