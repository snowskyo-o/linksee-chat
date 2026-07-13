import { computed } from "vue";
import { createChatStoreConversationDerived } from "./chat-store-conversation-derived.js";
import { createChatStoreMessageDerived } from "./chat-store-message-derived.js";
import { createChatStoreProfileDerived } from "./chat-store-profile-derived.js";

function buildTransferProgressText(active, fileName, progress, label) {
  return computed(() => {
    if (!active.value) return "";
    return fileName.value ? `正在${label} ${fileName.value} · ${progress.value}%` : `${label}中 ${progress.value}%`;
  });
}

export function createChatStoreDerived(auth, state) {
  return {
    ...createChatStoreProfileDerived(auth, state),
    ...createChatStoreConversationDerived(auth, state),
    ...createChatStoreMessageDerived(auth, state),
    uploadProgressText: buildTransferProgressText(state.uploadingFiles, state.uploadFileName, state.uploadProgress, "上传"),
    downloadProgressText: buildTransferProgressText(state.downloadingFile, state.downloadFileName, state.downloadProgress, "下载"),
  };
}
