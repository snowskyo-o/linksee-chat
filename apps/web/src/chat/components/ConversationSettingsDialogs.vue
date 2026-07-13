<script setup>
import FriendRemarkDialog from "./FriendRemarkDialog.vue";
import SettingsDialog from "./SettingsDialog.vue";
import UpdatePromptDialog from "./UpdatePromptDialog.vue";

defineProps({
  appInfo: { type: Object, default: () => ({}) },
  appSettings: { type: Object, default: () => ({}) },
  auth: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  passwordChange: { type: Object, default: () => ({}) },
  remarkDialogOpen: { type: Boolean, default: false },
  remarkDraft: { type: String, default: "" },
  remarkTarget: { type: Object, default: null },
  settingsOpen: { type: Boolean, default: false },
  store: { type: Object, default: () => ({}) },
  updatePromptOpen: { type: Boolean, default: false },
});

defineEmits([
  "choose-download-dir", "clear-cache", "close-remark", "close-settings", "close-update", "logout",
  "open-download-dir", "open-update", "remind-later", "save-profile", "submit-password", "submit-remark",
  "update:desktop-preferences", "update:profile-bio", "update:profile-name", "update:remark-draft",
  "update:settings", "update-now", "upload-avatar",
]);
</script>

<template>
  <FriendRemarkDialog :open="remarkDialogOpen" :contact="remarkTarget" :value="remarkDraft" @close="$emit('close-remark')" @update:value="$emit('update:remark-draft', $event)" @submit="$emit('submit-remark')" />

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

  <UpdatePromptDialog :open="updatePromptOpen" :update="appInfo.update" @update-now="$emit('update-now')" @remind-later="$emit('remind-later')" @close="$emit('close-update')" />
</template>
