<script setup>
import ChatDialogs from "./ChatDialogs.vue";

defineEmits(["logout"]);

defineProps({
  actions: { type: Object, required: true },
  auth: { type: Object, required: true },
  groupManagement: { type: Object, required: true },
  passwordChange: { type: Object, required: true },
  runtime: { type: Object, required: true },
  standaloneConversationMode: { type: Object, required: true },
  stickerLibrary: { type: Object, required: true },
  store: { type: Object, required: true },
});
</script>

<template>
  <ChatDialogs
    :standalone-conversation-mode="standaloneConversationMode"
    :update-prompt-open="runtime.updatePromptOpen.value"
    :app-info="runtime.appInfo.value"
    :settings-open="runtime.settingsOpen.value"
    :app-settings="runtime.appSettings.value"
    :desktop-preferences="runtime.desktopPreferences.value"
    :auth="auth"
    :store="store"
    :actions="actions"
    :password-change="passwordChange"
    :sticker-import-open="runtime.stickerImportOpen.value"
    :sticker-library="stickerLibrary"
    :image-viewer-open="runtime.imageViewerOpen.value"
    :image-viewer-title="runtime.imageViewerTitle.value"
    :image-viewer-src="runtime.imageViewerSrc.value"
    :image-viewer-loading="runtime.imageViewerLoading.value"
    :image-viewer-hint="runtime.imageViewerHint.value"
    :image-viewer-status-text="runtime.imageViewerStatusText.value"
    :image-viewer-active-file="runtime.imageViewerActiveFile.value"
    :image-viewer-owner-message-id="runtime.imageViewerOwnerMessageId.value"
    :group-management="groupManagement"
    @update-now="runtime.handleUpdateNow"
    @remind-later="runtime.remindUpdateLater"
    @close-update="runtime.closeUpdatePrompt"
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
    @close-sticker-import="runtime.closeStickerImport"
    @import-sticker-files="runtime.importStickerFiles"
    @import-sticker-folder="runtime.importStickerFolder"
    @open-sticker-folder="runtime.openStickerFolder"
    @rename-sticker="runtime.renameSticker"
    @delete-sticker="runtime.deleteSticker"
    @move-sticker="runtime.moveSticker"
    @close-image-viewer="runtime.closeImageViewer"
    @download-image="runtime.saveImageFromViewer"
    @copy-image="runtime.copyImageFromViewer"
    @forward-image="runtime.forwardImageFromViewer"
    @open-image-location="runtime.openImageLocationFromViewer"
  />
</template>
