<script setup>
import AnnouncementDialog from "./AnnouncementDialog.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import CreateConversationDialog from "./CreateConversationDialog.vue";
import ForwardDialog from "./ForwardDialog.vue";
import GroupInviteDialog from "./GroupInviteDialog.vue";

defineProps({
  actions: { type: Object, default: () => ({}) },
  groupManagement: { type: Object, default: () => ({}) },
  standaloneConversationMode: { type: Boolean, default: false },
  store: { type: Object, default: () => ({}) },
});
</script>

<template>
  <ForwardDialog
    :open="store.forwardDialogOpen.value"
    :conversations="store.filteredConversations.value"
    :selected-id="store.forwardConversationId.value"
    :hint="store.forwardHint.value"
    :submitting="store.forwardSubmitting.value"
    @close="store.closeForwardDialog"
    @update:selected-id="store.forwardConversationId.value = $event"
    @submit="actions.submitForwardMessage"
  />

  <GroupInviteDialog
    :open="groupManagement.inviteDialogOpen.value"
    :contacts="groupManagement.inviteableContacts.value"
    :selected-ids="groupManagement.inviteParticipantIds.value"
    :hint="groupManagement.inviteHint.value"
    :hint-tone="groupManagement.inviteHintTone.value"
    :submitting="groupManagement.inviteSubmitting.value"
    @close="groupManagement.closeInviteDialog"
    @toggle-contact="groupManagement.toggleInviteParticipant"
    @submit="groupManagement.submitInviteMembers"
  />

  <CreateConversationDialog
    v-if="!standaloneConversationMode"
    :open="store.createDialogOpen.value"
    :mode="store.createDialogMode.value"
    :title="store.createDialogTitle.value"
    :peer-id="store.selectedPeerId.value"
    :participant-ids="store.createDialogParticipantIds.value"
    :contacts="store.createDialogContacts.value"
    :selected-participants="store.selectedParticipants.value"
    :hint="store.createDialogHint.value"
    :hint-tone="store.createDialogHintTone.value"
    :submitting="store.createDialogSubmitting.value"
    @close="store.closeCreateDialog"
    @submit="actions.submitCreateConversation"
    @update:title="store.createDialogTitle.value = $event"
    @update:peer-id="store.createDialogPeerId.value = $event"
    @toggle-participant="store.toggleDialogParticipant"
  />

  <AnnouncementDialog
    :open="store.announcementDialogOpen.value"
    :draft="store.announcementDraft.value"
    :hint="store.announcementHint.value"
    :hint-tone="store.announcementHintTone.value"
    :submitting="store.announcementSubmitting.value"
    @close="store.closeAnnouncementDialog"
    @submit="actions.submitAnnouncement"
    @update:draft="store.announcementDraft.value = $event"
  />

  <ConfirmDialog
    :open="store.confirmDialogOpen.value"
    :title="store.confirmDialogTitle.value"
    :message="store.confirmDialogMessage.value"
    :confirm-text="store.confirmDialogConfirmText.value"
    :submitting="store.confirmDialogSubmitting.value"
    @close="store.closeConfirmDialog"
    @submit="actions.submitConfirmDialog"
  />
</template>
