<script setup>
import ChatMediaDialogs from "./ChatMediaDialogs.vue";
import ChatSettingsDialogs from "./ChatSettingsDialogs.vue";
import { chatAppDialogEmits, chatAppDialogProps } from "./chat-app-dialog-contract.js";

const props = defineProps(chatAppDialogProps);
const emit = defineEmits(chatAppDialogEmits);

const settingsListeners = {
  "choose-download-dir": () => emit("choose-download-dir"),
  "clear-cache": () => emit("clear-cache"),
  "close-settings": () => emit("close-settings"),
  "close-update": () => emit("close-update"),
  logout: () => emit("logout"),
  "open-download-dir": () => emit("open-download-dir"),
  "open-update": () => emit("open-update"),
  "remind-later": () => emit("remind-later"),
  "save-profile": () => emit("save-profile"),
  "submit-password": (value) => emit("submit-password", value),
  "update-now": () => emit("update-now"),
  "update:desktop-preferences": (value) => emit("update:desktop-preferences", value),
  "update:profile-bio": (value) => emit("update:profile-bio", value),
  "update:profile-name": (value) => emit("update:profile-name", value),
  "update:settings": (value) => emit("update:settings", value),
  "upload-avatar": (value) => emit("upload-avatar", value),
};

const mediaListeners = {
  "close-image-viewer": () => emit("close-image-viewer"),
  "close-sticker-import": () => emit("close-sticker-import"),
  "copy-image": () => emit("copy-image"),
  "delete-sticker": (value) => emit("delete-sticker", value),
  "download-image": () => emit("download-image"),
  "forward-image": () => emit("forward-image"),
  "import-sticker-files": () => emit("import-sticker-files"),
  "import-sticker-folder": () => emit("import-sticker-folder"),
  "move-sticker": (value) => emit("move-sticker", value),
  "open-image-location": () => emit("open-image-location"),
  "open-sticker-folder": () => emit("open-sticker-folder"),
  "rename-sticker": (value) => emit("rename-sticker", value),
};
</script>

<template>
  <ChatSettingsDialogs
    :update-prompt-open="props.updatePromptOpen"
    :app-info="props.appInfo"
    :settings-open="props.settingsOpen"
    :app-settings="props.appSettings"
    :desktop-preferences="props.desktopPreferences"
    :auth="props.auth"
    :store="props.store"
    :password-change="props.passwordChange"
    v-on="settingsListeners"
  />

  <ChatMediaDialogs
    :app-info="props.appInfo"
    :sticker-import-open="props.stickerImportOpen"
    :sticker-library="props.stickerLibrary"
    :image-viewer-open="props.imageViewerOpen"
    :image-viewer-title="props.imageViewerTitle"
    :image-viewer-src="props.imageViewerSrc"
    :image-viewer-loading="props.imageViewerLoading"
    :image-viewer-hint="props.imageViewerHint"
    :image-viewer-status-text="props.imageViewerStatusText"
    :image-viewer-active-file="props.imageViewerActiveFile"
    :image-viewer-owner-message-id="props.imageViewerOwnerMessageId"
    v-on="mediaListeners"
  />
</template>
