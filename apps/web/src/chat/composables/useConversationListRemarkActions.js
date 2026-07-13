export function useConversationListRemarkActions({ actions, friendCenter, remarkDialogOpen, remarkDraft, remarkTarget }) {
  function openFriendRemark(contact) {
    remarkTarget.value = contact || null;
    remarkDraft.value = String(contact?.friendAlias || "");
    remarkDialogOpen.value = true;
  }

  function closeFriendRemark() {
    remarkDialogOpen.value = false;
  }

  async function submitFriendRemark() {
    if (!remarkTarget.value?.id) return;
    await friendCenter.updateAlias(remarkTarget.value.id, remarkDraft.value);
    await actions.loadContacts().catch(() => {});
    await actions.loadConversations().catch(() => {});
    remarkDialogOpen.value = false;
  }

  return {
    closeFriendRemark,
    openFriendRemark,
    submitFriendRemark,
  };
}
