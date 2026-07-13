<script setup>
import ChatAppDialogs from "./ChatAppDialogs.vue";
import ChatConversationDialogs from "./ChatConversationDialogs.vue";
import ToastStack from "./ToastStack.vue";

defineProps({
  standaloneConversationMode: { type: Boolean, default: false },
  updatePromptOpen: { type: Boolean, default: false },
  appInfo: { type: Object, default: () => ({}) },
  settingsOpen: { type: Boolean, default: false },
  appSettings: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  auth: { type: Object, default: () => ({}) },
  store: { type: Object, default: () => ({}) },
  passwordChange: { type: Object, default: () => ({}) },
  stickerImportOpen: { type: Boolean, default: false },
  stickerLibrary: { type: Object, default: () => ({}) },
  imageViewerOpen: { type: Boolean, default: false },
  imageViewerTitle: { type: String, default: "" },
  imageViewerSrc: { type: String, default: "" },
  imageViewerLoading: { type: Boolean, default: false },
  imageViewerHint: { type: String, default: "" },
  imageViewerStatusText: { type: String, default: "" },
  imageViewerActiveFile: { type: Object, default: null },
  imageViewerOwnerMessageId: { type: String, default: "" },
  groupManagement: { type: Object, default: () => ({}) },
  actions: { type: Object, default: () => ({}) },
});

defineEmits([
  "update-now",
  "remind-later",
  "close-update",
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
  "close-sticker-import",
  "import-sticker-files",
  "import-sticker-folder",
  "open-sticker-folder",
  "rename-sticker",
  "delete-sticker",
  "move-sticker",
  "close-image-viewer",
  "download-image",
  "copy-image",
  "forward-image",
  "open-image-location",
]);
</script>

<template>
  <ToastStack :notifications="store.notifications.value" @dismiss="store.dismissNotification" />

  <ChatAppDialogs
    :update-prompt-open="updatePromptOpen"
    :app-info="appInfo"
    :settings-open="settingsOpen"
    :app-settings="appSettings"
    :desktop-preferences="desktopPreferences"
    :auth="auth"
    :store="store"
    :password-change="passwordChange"
    :sticker-import-open="stickerImportOpen"
    :sticker-library="stickerLibrary"
    :image-viewer-open="imageViewerOpen"
    :image-viewer-title="imageViewerTitle"
    :image-viewer-src="imageViewerSrc"
    :image-viewer-loading="imageViewerLoading"
    :image-viewer-hint="imageViewerHint"
    :image-viewer-status-text="imageViewerStatusText"
    :image-viewer-active-file="imageViewerActiveFile"
    :image-viewer-owner-message-id="imageViewerOwnerMessageId"
    @update-now="$emit('update-now')"
    @remind-later="$emit('remind-later')"
    @close-update="$emit('close-update')"
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
    @close-sticker-import="$emit('close-sticker-import')"
    @import-sticker-files="$emit('import-sticker-files')"
    @import-sticker-folder="$emit('import-sticker-folder')"
    @open-sticker-folder="$emit('open-sticker-folder')"
    @rename-sticker="$emit('rename-sticker', $event)"
    @delete-sticker="$emit('delete-sticker', $event)"
    @move-sticker="$emit('move-sticker', $event)"
    @close-image-viewer="$emit('close-image-viewer')"
    @download-image="$emit('download-image')"
    @copy-image="$emit('copy-image')"
    @forward-image="$emit('forward-image')"
    @open-image-location="$emit('open-image-location')"
  />

  <ChatConversationDialogs
    :actions="actions"
    :group-management="groupManagement"
    :standalone-conversation-mode="standaloneConversationMode"
    :store="store"
  />
</template>
