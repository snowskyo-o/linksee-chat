export function getCurrentGroupId(store) {
  const selected = store.selectedConversation.value;
  return selected?.kind === "group" ? String(selected.id || "") : "";
}

export async function reloadGroupConversation(store, actions, preferredConversationId = getCurrentGroupId(store)) {
  await actions.loadConversations();
  const nextConversationId = store.conversations.value.find((row) => String(row.id) === String(preferredConversationId))
    ? String(preferredConversationId)
    : String(store.conversations.value[0]?.id || "");
  if (!nextConversationId) {
    store.selectedId.value = "";
    store.participants.value = [];
    store.messages.value = [];
    store.hasMoreMessages.value = false;
    return;
  }
  await actions.selectConversation(nextConversationId);
}
