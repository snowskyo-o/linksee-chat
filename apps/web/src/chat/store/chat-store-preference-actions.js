import { saveConversationPreferences } from "../../shared/conversation-preferences.js";

export function createChatStorePreferenceActions(state) {
  function persistConversationPreferences() {
    const saved = saveConversationPreferences({
      mutedConversationIds: state.mutedConversationIds.value,
      hiddenConversationIds: state.hiddenConversationIds.value,
    });
    state.mutedConversationIds.value = saved.mutedConversationIds;
    state.hiddenConversationIds.value = saved.hiddenConversationIds;
  }

  function toggleConversationMuted(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return false;
    state.mutedConversationIds.value = state.mutedConversationIds.value.includes(targetId)
      ? state.mutedConversationIds.value.filter((item) => item !== targetId)
      : [...state.mutedConversationIds.value, targetId];
    persistConversationPreferences();
    return state.mutedConversationIds.value.includes(targetId);
  }

  function hideConversation(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return;
    state.hiddenConversationIds.value = state.hiddenConversationIds.value.includes(targetId)
      ? state.hiddenConversationIds.value
      : [...state.hiddenConversationIds.value, targetId];
    persistConversationPreferences();
  }

  function showConversation(conversationId) {
    const targetId = String(conversationId || "");
    if (!targetId) return;
    state.hiddenConversationIds.value = state.hiddenConversationIds.value.filter((item) => item !== targetId);
    persistConversationPreferences();
  }

  return {
    hideConversation,
    showConversation,
    toggleConversationMuted,
  };
}
