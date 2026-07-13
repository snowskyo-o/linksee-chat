<script setup>
import ImageViewerDialog from "./ImageViewerDialog.vue";
import SettingsDialog from "./SettingsDialog.vue";
import StickerImportDialog from "./StickerImportDialog.vue";
import UpdatePromptDialog from "./UpdatePromptDialog.vue";

defineProps({
  appInfo: { type: Object, default: () => ({}) },
  appSettings: { type: Object, default: () => ({}) },
  auth: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  imageViewerActiveFile: { type: Object, default: null },
  imageViewerHint: { type: String, default: "" },
  imageViewerLoading: { type: Boolean, default: false },
  imageViewerOpen: { type: Boolean, default: false },
  imageViewerOwnerMessageId: { type: String, default: "" },
  imageViewerSrc: { type: String, default: "" },
  imageViewerStatusText: { type: String, default: "" },
  imageViewerTitle: { type: String, default: "" },
  passwordChange: { type: Object, default: () => ({}) },
  settingsOpen: { type: Boolean, default: false },
  stickerImportOpen: { type: Boolean, default: false },
  stickerLibrary: { type: Object, default: () => ({}) },
  store: { type: Object, default: () => ({}) },
  updatePromptOpen: { type: Boolean, default: false },
});

defineEmits([
  "choose-download-dir",
  "clear-cache",
  "close-image-viewer",
  "close-settings",
  "close-sticker-import",
  "close-update",
  "copy-image",
  "delete-sticker",
  "download-image",
  "forward-image",
  "import-sticker-files",
  "import-sticker-folder",
  "logout",
  "move-sticker",
  "open-download-dir",
  "open-image-location",
  "open-sticker-folder",
  "open-update",
  "remind-later",
  "rename-sticker",
  "save-profile",
  "submit-password",
  "update-now",
  "update:desktop-preferences",
  "update:profile-bio",
  "update:profile-name",
  "update:settings",
  "upload-avatar",
]);
</script>

<template>
  <UpdatePromptDialog
    :open="updatePromptOpen"
    :update="appInfo.update"
    @update-now="$emit('update-now')"
    @remind-later="$emit('remind-later')"
    @close="$emit('close-update')"
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

  <StickerImportDialog
    :open="stickerImportOpen"
    :storage="appInfo.storage"
    :stickers="stickerLibrary.stickers.value"
    :hint="stickerLibrary.hint.value"
    :hint-tone="stickerLibrary.hintTone.value"
    @close="$emit('close-sticker-import')"
    @import-files="$emit('import-sticker-files')"
    @import-folder="$emit('import-sticker-folder')"
    @open-sticker-folder="$emit('open-sticker-folder')"
    @rename-sticker="$emit('rename-sticker', $event)"
    @delete-sticker="$emit('delete-sticker', $event)"
    @move-sticker="$emit('move-sticker', $event)"
  />

  <ImageViewerDialog
    :open="imageViewerOpen"
    :title="imageViewerTitle"
    :src="imageViewerSrc"
    :loading="imageViewerLoading"
    :hint="imageViewerHint"
    :status-text="imageViewerStatusText"
    :can-download="Boolean(imageViewerActiveFile?.objectKey)"
    :can-copy="Boolean(imageViewerActiveFile?.objectKey)"
    :can-forward="Boolean(imageViewerOwnerMessageId)"
    :can-open-location="Boolean(imageViewerActiveFile?.transfer?.status === 'saved' && imageViewerActiveFile?.transfer?.path)"
    @close="$emit('close-image-viewer')"
    @download="$emit('download-image')"
    @copy="$emit('copy-image')"
    @forward="$emit('forward-image')"
    @open-location="$emit('open-image-location')"
  />
</template>
