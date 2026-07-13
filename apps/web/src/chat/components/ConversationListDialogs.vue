<script setup>
import CreateConversationDialog from "./CreateConversationDialog.vue";
import ConversationFriendDialogs from "./ConversationFriendDialogs.vue";
import ConversationSettingsDialogs from "./ConversationSettingsDialogs.vue";

defineProps({
  store: { type: Object, default: () => ({}) },
  actions: { type: Object, default: () => ({}) },
  friendCenter: { type: Object, default: () => ({}) },
  passwordChange: { type: Object, default: () => ({}) },
  auth: { type: Object, default: () => ({}) },
  appSettings: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  appInfo: { type: Object, default: () => ({}) },
  settingsOpen: { type: Boolean, default: false },
  remarkDialogOpen: { type: Boolean, default: false },
  remarkDraft: { type: String, default: "" },
  remarkTarget: { type: Object, default: null },
  updatePromptOpen: { type: Boolean, default: false },
});

defineEmits([
  "close-settings",
  "update:settings",
  "update:desktop-preferences",
  "update:profile-name",
  "update:profile-bio",
  "save-profile",
  "submit-password",
  "logout",
  "upload-avatar",
  "choose-download-dir",
  "open-download-dir",
  "clear-cache",
  "open-update",
  "close-update",
  "update-now",
  "remind-later",
  "close-remark",
  "update:remark-draft",
  "submit-remark",
  "start-chat",
  "edit-friend",
]);
</script>

<template>
  <CreateConversationDialog
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

  <ConversationFriendDialogs :friend-center="friendCenter" @start-chat="$emit('start-chat', $event)" @edit-friend="$emit('edit-friend', $event)" />
  <ConversationSettingsDialogs
    :app-info="appInfo"
    :app-settings="appSettings"
    :auth="auth"
    :desktop-preferences="desktopPreferences"
    :password-change="passwordChange"
    :remark-dialog-open="remarkDialogOpen"
    :remark-draft="remarkDraft"
    :remark-target="remarkTarget"
    :settings-open="settingsOpen"
    :store="store"
    :update-prompt-open="updatePromptOpen"
    @close-settings="$emit('close-settings')"
    @update:settings="$emit('update:settings', $event)"
    @update:desktop-preferences="$emit('update:desktop-preferences', $event)"
    @update:profile-name="$emit('update:profile-name', $event)"
    @update:profile-bio="$emit('update:profile-bio', $event)"
    @save-profile="$emit('save-profile')"
    @submit-password="$emit('submit-password', $event)"
    @logout="$emit('logout')"
    @upload-avatar="$emit('upload-avatar', $event)"
    @choose-download-dir="$emit('choose-download-dir')"
    @open-download-dir="$emit('open-download-dir')"
    @clear-cache="$emit('clear-cache')"
    @open-update="$emit('open-update')"
    @close-update="$emit('close-update')"
    @update-now="$emit('update-now')"
    @remind-later="$emit('remind-later')"
    @close-remark="$emit('close-remark')"
    @update:remark-draft="$emit('update:remark-draft', $event)"
    @submit-remark="$emit('submit-remark')"
  />
</template>
