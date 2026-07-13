import { computed } from "vue";
import { resolveMediaUrl } from "../../shared/media.js";
import {
  buildDerivedConversationPreview,
  buildDerivedConversationSubtitle,
  buildDerivedConversationTitle,
} from "./chat-store-derived-utils.js";

function conversationRank(row) {
  const pinnedRank = row.pinnedAt ? 1 : 0;
  const mentionRank = Number(row.unreadMentionCount || 0) > 0 ? 1 : 0;
  const unreadRank = Number(row.unreadCount || 0) > 0 ? 1 : 0;
  const timeRank = new Date(row.pinnedAt || row.updatedAt || 0).getTime();
  return { pinnedRank, mentionRank, unreadRank, timeRank };
}

export function createChatStoreConversationDerived(auth, state) {
  const selectedConversation = computed(() => state.conversations.value.find((item) => item.id === state.selectedId.value) || null);
  const selectedPeerId = computed(() => state.createDialogPeerId.value || state.contacts.value[0]?.id || "");
  const selectedParticipants = computed(() => state.contacts.value.filter((user) => state.createDialogParticipantIds.value.includes(user.id)));

  const createDialogContacts = computed(() => state.contacts.value.map((user) => ({
    id: user.id,
    name: user.friendAlias || user.profile?.realName || user.id,
    realName: user.profile?.originalRealName || user.profile?.realName || user.id,
    friendAlias: user.friendAlias || "",
    bio: user.profile?.bio || "",
    avatarUrl: resolveMediaUrl(user.profile?.avatarUrl || ""),
  })));

  const conversationRows = computed(() => state.conversations.value.map((row) => {
    const title = buildDerivedConversationTitle(row, auth.userId);
    const subtitle = buildDerivedConversationSubtitle(row, auth.userId);
    const peer = row.kind === "direct" ? (row.participants || []).find((item) => item.id !== auth.userId) : null;
    return {
      ...row,
      displayTitle: title,
      displaySubtitle: subtitle,
      isMuted: state.mutedConversationIds.value.includes(String(row.id || "")),
      isHidden: state.hiddenConversationIds.value.includes(String(row.id || "")),
      avatarUrl: row.kind === "direct" ? resolveMediaUrl(peer?.profile?.avatarUrl || "") : "",
      preview: buildDerivedConversationPreview(row),
    };
  }).sort((a, b) => {
    const aRank = conversationRank(a);
    const bRank = conversationRank(b);
    if (aRank.pinnedRank !== bRank.pinnedRank) return bRank.pinnedRank - aRank.pinnedRank;
    if (aRank.mentionRank !== bRank.mentionRank) return bRank.mentionRank - aRank.mentionRank;
    if (aRank.unreadRank !== bRank.unreadRank) return bRank.unreadRank - aRank.unreadRank;
    return bRank.timeRank - aRank.timeRank;
  }));

  return {
    chatTitle: computed(() => buildDerivedConversationTitle(selectedConversation.value, auth.userId) || "请选择会话"),
    chatSubtitle: computed(() => (
      selectedConversation.value
        ? buildDerivedConversationSubtitle(selectedConversation.value, auth.userId)
        : "选择一个会话开始聊天"
    )),
    conversationRows,
    createDialogContacts,
    filteredConversations: computed(() => {
      const keyword = state.conversationKeyword.value.trim().toLowerCase();
      const visibleRows = conversationRows.value.filter((row) => !row.isHidden);
      if (!keyword) return visibleRows;
      return visibleRows.filter((row) => (
        [row.displayTitle, row.displaySubtitle, row.preview].some((value) => String(value || "").toLowerCase().includes(keyword))
      ));
    }),
    selectedConversation,
    selectedParticipants,
    selectedPeerId,
  };
}
