import { readDraftAttachments, writeDraftAttachments } from "./draft-attachments-cache.js";
import { restorePendingAttachment } from "./file-attachments.js";
import { readChatCache, writeChatCache } from "./local-chat-cache.js";

export function createChatDraftActions({ cacheUserId }) {
  const getDraftCacheKey = (conversationId) => `draft-${conversationId}`;

  async function saveConversationDraft(conversationId, draft = "", pendingFiles = []) {
    const targetId = String(conversationId || "").trim();
    if (!targetId) return;
    const userId = cacheUserId();
    await Promise.allSettled([
      writeChatCache(userId, getDraftCacheKey(targetId), {
        data: { text: String(draft || "") },
        cachedAt: new Date().toISOString(),
      }).catch(() => {}),
      writeDraftAttachments(userId, targetId, pendingFiles).catch(() => false),
    ]);
  }

  async function loadConversationDraft(conversationId) {
    const targetId = String(conversationId || "").trim();
    if (!targetId) return { text: "", files: [] };
    const userId = cacheUserId();
    const [cached, draftFiles] = await Promise.all([
      readChatCache(userId, getDraftCacheKey(targetId)),
      readDraftAttachments(userId, targetId),
    ]);
    return {
      text: String(cached?.data?.text || ""),
      files: draftFiles.map((entry) => restorePendingAttachment(entry)).filter(Boolean),
    };
  }

  return {
    loadConversationDraft,
    saveConversationDraft,
  };
}
