export function buildOptimisticTextMessage(store, content, mentions = [], replyTo = null) {
  const now = new Date().toISOString();
  const me = store.me.value || {};
  return {
    id: `local-${Date.now()}`,
    clientId: `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    replyTo,
    operationState: "sending",
  };
}

export function buildFileMessageContent(files) {
  if (!Array.isArray(files) || files.length === 0) return "附件";
  if (files.length === 1) return files[0].name || "附件";
  if (files.length === 2) return `${files[0].name || "附件"}、${files[1].name || "附件"}`;
  return `${files[0].name || "附件"} 等 ${files.length} 个文件`;
}
