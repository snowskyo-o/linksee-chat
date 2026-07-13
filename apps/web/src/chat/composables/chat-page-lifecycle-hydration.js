export async function hydrateInitialConversation({ actions, desktopConversationId, reloadSelectedConversation, standaloneConversationMode, store }) {
  if (standaloneConversationMode.value && desktopConversationId) {
    await actions.selectConversation(desktopConversationId).catch(() => {});
    return;
  }
  await reloadSelectedConversation();
  if (!store.selectedId.value) return;
  const draft = await actions.loadConversationDraft(store.selectedId.value);
  store.messageInput.value = draft.text || "";
  store.pendingFiles.value = Array.isArray(draft.files) ? draft.files : [];
  store.updateMentionState(store.messageInput.value);
}
