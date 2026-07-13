import { computed, ref } from "vue";
import { chatApi } from "../../shared/api-client.js";

export function useGroupManagement(store, actions) {
  const inviteDialogOpen = ref(false);
  const inviteParticipantIds = ref([]);
  const inviteHint = ref("");
  const inviteHintTone = ref("");
  const inviteSubmitting = ref(false);

  const inviteableContacts = computed(() => {
    const existingIds = new Set((store.participants.value || []).map((user) => String(user.id || "")));
    return store.createDialogContacts.value.filter((contact) => !existingIds.has(String(contact.id || "")));
  });

  function currentGroupId() {
    const selected = store.selectedConversation.value;
    return selected?.kind === "group" ? String(selected.id || "") : "";
  }

  async function reloadAfterConversationChange(preferredConversationId = currentGroupId()) {
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

  async function renameGroup(title) {
    const conversationId = currentGroupId();
    if (!conversationId) return;
    const nextTitle = String(title || "").trim();
    if (!nextTitle) {
      store.setComposerHint("请输入群聊名称", "error");
      return;
    }
    await chatApi.patchJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/group`, { title: nextTitle });
    await reloadAfterConversationChange(conversationId);
    store.pushNotification({ title: "群名称已更新", message: nextTitle, tone: "success", ttl: 1800 });
  }

  function openInviteDialog() {
    if (!currentGroupId()) return;
    if (!inviteableContacts.value.length) {
      store.pushNotification({ title: "没有可邀请成员", message: "当前联系人都已在群聊中。", tone: "error" });
      return;
    }
    inviteParticipantIds.value = inviteableContacts.value.slice(0, 1).map((contact) => contact.id);
    inviteHint.value = "";
    inviteHintTone.value = "";
    inviteSubmitting.value = false;
    inviteDialogOpen.value = true;
  }

  function closeInviteDialog() {
    inviteDialogOpen.value = false;
    inviteParticipantIds.value = [];
    inviteHint.value = "";
    inviteHintTone.value = "";
    inviteSubmitting.value = false;
  }

  function toggleInviteParticipant(userId) {
    const targetId = String(userId || "");
    if (!targetId) return;
    inviteParticipantIds.value = inviteParticipantIds.value.includes(targetId)
      ? inviteParticipantIds.value.filter((id) => id !== targetId)
      : [...inviteParticipantIds.value, targetId];
  }

  async function submitInviteMembers() {
    const conversationId = currentGroupId();
    if (!conversationId) return;
    if (!inviteParticipantIds.value.length) {
      inviteHint.value = "请至少选择一位联系人";
      inviteHintTone.value = "error";
      return;
    }
    inviteSubmitting.value = true;
    inviteHint.value = "";
    inviteHintTone.value = "";
    try {
      await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/members`, {
        participantIds: inviteParticipantIds.value,
      });
      closeInviteDialog();
      await reloadAfterConversationChange(conversationId);
      store.pushNotification({ title: "已邀请新成员", message: "群成员列表已更新。", tone: "success", ttl: 1800 });
    } catch (error) {
      inviteHint.value = error?.message || "邀请成员失败";
      inviteHintTone.value = "error";
    } finally {
      inviteSubmitting.value = false;
    }
  }

  function requestLeaveGroup() {
    const conversation = store.selectedConversation.value;
    const conversationId = currentGroupId();
    if (!conversationId) return;
    store.openConfirmDialog({
      title: "退出群聊",
      message: `退出“${conversation?.title || "当前群聊"}”后，你将不再接收这个群的消息。`,
      confirmText: "退出群聊",
      action: async () => {
        await chatApi.postJson(`/api/v1/conversations/${encodeURIComponent(conversationId)}/leave`, {});
        await reloadAfterConversationChange("");
        store.pushNotification({ title: "已退出群聊", message: conversation?.title || "当前群聊", tone: "success", ttl: 1800 });
      },
    });
  }

  function requestRemoveMember(member) {
    const conversationId = currentGroupId();
    if (!conversationId || !member?.id) return;
    const memberName = member.friendAlias || member.profile?.realName || member.id;
    store.openConfirmDialog({
      title: "移除群成员",
      message: `确认将“${memberName}”移出当前群聊吗？`,
      confirmText: "移除成员",
      action: async () => {
        await chatApi.delete(`/api/v1/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(member.id)}`);
        await reloadAfterConversationChange(conversationId);
        store.pushNotification({ title: "成员已移除", message: memberName, tone: "success", ttl: 1800 });
      },
    });
  }

  return {
    closeInviteDialog,
    inviteDialogOpen,
    inviteHint,
    inviteHintTone,
    inviteParticipantIds,
    inviteSubmitting,
    inviteableContacts,
    openInviteDialog,
    renameGroup,
    requestLeaveGroup,
    requestRemoveMember,
    submitInviteMembers,
    toggleInviteParticipant,
  };
}
