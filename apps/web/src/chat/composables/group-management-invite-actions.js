import { computed, ref } from "vue";
import { chatApi } from "../../shared/api-client.js";
import { getCurrentGroupId, reloadGroupConversation } from "./group-management-shared.js";

export function useGroupInviteActions(store, actions) {
  const inviteDialogOpen = ref(false);
  const inviteParticipantIds = ref([]);
  const inviteHint = ref("");
  const inviteHintTone = ref("");
  const inviteSubmitting = ref(false);

  const inviteableContacts = computed(() => {
    const existingIds = new Set((store.participants.value || []).map((user) => String(user.id || "")));
    return store.createDialogContacts.value.filter((contact) => !existingIds.has(String(contact.id || "")));
  });

  function openInviteDialog() {
    if (!getCurrentGroupId(store)) return;
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
    const conversationId = getCurrentGroupId(store);
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
      await reloadGroupConversation(store, actions, conversationId);
      store.pushNotification({ title: "已邀请新成员", message: "群成员列表已更新。", tone: "success", ttl: 1800 });
    } catch (error) {
      inviteHint.value = error?.message || "邀请成员失败";
      inviteHintTone.value = "error";
    } finally {
      inviteSubmitting.value = false;
    }
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
    submitInviteMembers,
    toggleInviteParticipant,
  };
}
