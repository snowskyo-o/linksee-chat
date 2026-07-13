<script setup>
import CreateConversationDialog from "./CreateConversationDialog.vue";
import NewFriendsDialog from "./NewFriendsDialog.vue";
import FriendRemarkDialog from "./FriendRemarkDialog.vue";
import SettingsDialog from "./SettingsDialog.vue";
import UpdatePromptDialog from "./UpdatePromptDialog.vue";

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

  <NewFriendsDialog
    :open="friendCenter.open.value"
    :keyword="friendCenter.keyword.value"
    :loading="friendCenter.loading.value"
    :hint="friendCenter.hint.value"
    :hint-tone="friendCenter.hintTone.value"
    :recent-contacts="friendCenter.recentContacts.value"
    :incoming-requests="friendCenter.incomingRequests.value"
    :outgoing-requests="friendCenter.outgoingRequests.value"
    :recommended-users="friendCenter.recommendedUsers.value"
    :friend-contacts="friendCenter.friendContacts.value"
    @close="friendCenter.closeCenter()"
    @update:keyword="friendCenter.keyword.value = $event"
    @start-chat="$emit('start-chat', $event)"
    @edit-friend="$emit('edit-friend', $event)"
    @remove-friend="friendCenter.removeFriend($event).catch(() => {})"
    @send-request="friendCenter.sendRequest"
    @accept-request="friendCenter.resolveRequest($event, 'accept', '已通过好友申请')"
    @reject-request="friendCenter.resolveRequest($event, 'reject', '已拒绝好友申请')"
    @cancel-request="friendCenter.resolveRequest($event, 'cancel', '已取消好友申请')"
  />

  <FriendRemarkDialog
    :open="remarkDialogOpen"
    :contact="remarkTarget"
    :value="remarkDraft"
    @close="$emit('close-remark')"
    @update:value="$emit('update:remark-draft', $event)"
    @submit="$emit('submit-remark')"
  />

  <SettingsDialog
    :open="settingsOpen"
    :settings="appSettings"
    :desktop-preferences="desktopPreferences"
    :profile-account="store.me.value?.id || auth.userId"
    :profile-role="store.me.value?.role || auth.role"
    :profile-name="store.profileName.value"
    :profile-bio="store.profileBio.value"
    :profile-hint="store.profileHint.value"
    :profile-hint-tone="store.profileHintTone.value"
    :password-hint="passwordChange.passwordHint.value"
    :password-hint-tone="passwordChange.passwordHintTone.value"
    :password-submitting="passwordChange.passwordSubmitting.value"
    :me-avatar-url="store.meAvatarUrl.value"
    :app-info="appInfo"
    @close="$emit('close-settings')"
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
  />

  <UpdatePromptDialog
    :open="updatePromptOpen"
    :update="appInfo.update"
    @update-now="$emit('update-now')"
    @remind-later="$emit('remind-later')"
    @close="$emit('close-update')"
  />
</template>
