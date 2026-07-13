<script setup>
import ConversationListDialogs from "./ConversationListDialogs.vue";

defineProps({
  actions: { type: Object, required: true },
  appInfo: { type: Object, required: true },
  appSettings: { type: Object, required: true },
  auth: { type: Object, required: true },
  desktopPreferences: { type: Object, required: true },
  friendCenter: { type: Object, required: true },
  passwordChange: { type: Object, required: true },
  runtime: { type: Object, required: true },
  store: { type: Object, required: true },
});
</script>

<template>
  <ConversationListDialogs
    :store="store"
    :actions="actions"
    :friend-center="friendCenter"
    :password-change="passwordChange"
    :auth="auth"
    :app-settings="appSettings"
    :desktop-preferences="desktopPreferences"
    :app-info="appInfo"
    :settings-open="runtime.settingsOpen.value"
    :remark-dialog-open="runtime.remarkDialogOpen.value"
    :remark-draft="runtime.remarkDraft.value"
    :remark-target="runtime.remarkTarget.value"
    :update-prompt-open="runtime.updatePromptOpen.value"
    @close-settings="runtime.closeSettings"
    @update:settings="runtime.persistSettings"
    @update:desktop-preferences="runtime.persistDesktopPreferences"
    @update:profile-name="store.profileName.value = $event"
    @update:profile-bio="store.profileBio.value = $event"
    @save-profile="actions.saveProfile"
    @submit-password="passwordChange.submitPassword"
    @logout="$emit('logout')"
    @upload-avatar="runtime.handleAvatarUpload"
    @choose-download-dir="runtime.chooseDownloadDirectory"
    @open-download-dir="runtime.openDownloadDirectory"
    @clear-cache="runtime.clearDesktopCache"
    @open-update="runtime.handleUpdateNow"
    @close-update="runtime.closeUpdatePrompt"
    @update-now="runtime.handleUpdateNow"
    @remind-later="runtime.remindUpdateLater"
    @close-remark="runtime.closeFriendRemark"
    @update:remark-draft="runtime.remarkDraft.value = $event"
    @submit-remark="runtime.submitFriendRemark"
    @start-chat="runtime.startChatFromNewFriends"
    @edit-friend="runtime.openFriendRemark"
  />
</template>
