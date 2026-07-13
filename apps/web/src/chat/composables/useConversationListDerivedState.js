import { computed, ref } from "vue";
import { buildFavoriteMessagePreview } from "../store/chat-store-derived-utils.js";

export function useConversationListDerivedState(store) {
  const searchFocused = ref(false);
  const quickCreateOpen = ref(false);
  const activePane = ref("messages");
  const remarkDialogOpen = ref(false);
  const remarkDraft = ref("");
  const remarkTarget = ref(null);

  const unreadTotal = computed(() => store.filteredConversations.value.reduce((sum, row) => {
    return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
  }, 0));

  const filteredFavorites = computed(() => {
    const keyword = store.conversationKeyword.value.trim().toLowerCase();
    return store.favoriteMessages.value.filter((item) => {
      if (!keyword) return true;
      return [item.conversationTitle, item.senderName, item.content, buildFavoriteMessagePreview(item)]
        .some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  });

  const searchKeyword = computed(() => store.conversationKeyword.value.trim());

  const contactRows = computed(() => store.createDialogContacts.value.map((contact) => ({
    key: `contact:${contact.id}`,
    id: contact.id,
    title: contact.name,
    subtitle: contact.friendAlias && contact.realName && contact.realName !== contact.friendAlias
      ? `${contact.realName}${contact.bio ? ` · ${contact.bio}` : ""}`
      : (contact.bio || "联系人"),
    meta: "联系人",
    kind: "contact",
    avatarUrl: contact.avatarUrl,
    avatarText: contact.name.slice(0, 2).toUpperCase(),
  })));

  const filteredContacts = computed(() => {
    const keyword = searchKeyword.value.toLowerCase();
    if (!keyword) return contactRows.value;
    return contactRows.value.filter((row) => (
      [row.title, row.subtitle].some((value) => String(value || "").toLowerCase().includes(keyword))
    ));
  });

  const searchPanelOpen = computed(() => searchFocused.value || Boolean(searchKeyword.value));
  const visibleConversations = computed(() => (
    searchPanelOpen.value ? store.conversationRows.value : store.filteredConversations.value
  ));

  return {
    activePane,
    contactRows,
    filteredContacts,
    filteredFavorites,
    quickCreateOpen,
    remarkDialogOpen,
    remarkDraft,
    remarkTarget,
    searchFocused,
    searchKeyword,
    searchPanelOpen,
    unreadTotal,
    visibleConversations,
  };
}
