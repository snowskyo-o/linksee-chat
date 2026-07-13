<script setup>
import ChatAppDialogs from "./ChatAppDialogs.vue";
import ChatConversationDialogs from "./ChatConversationDialogs.vue";
import ToastStack from "./ToastStack.vue";
import { chatDialogEmits, chatDialogProps } from "./chat-dialog-contract.js";

const props = defineProps(chatDialogProps);
const emit = defineEmits(chatDialogEmits);

const appDialogListeners = {
  "choose-download-dir": () => emit("choose-download-dir"),
  "clear-cache": () => emit("clear-cache"),
  "close-image-viewer": () => emit("close-image-viewer"),
  "close-settings": () => emit("close-settings"),
  "close-sticker-import": () => emit("close-sticker-import"),
  "close-update": () => emit("close-update"),
  "copy-image": () => emit("copy-image"),
  "delete-sticker": (value) => emit("delete-sticker", value),
  "download-image": () => emit("download-image"),
  "forward-image": () => emit("forward-image"),
  "import-sticker-files": () => emit("import-sticker-files"),
  "import-sticker-folder": () => emit("import-sticker-folder"),
  logout: () => emit("logout"),
  "move-sticker": (value) => emit("move-sticker", value),
  "open-download-dir": () => emit("open-download-dir"),
  "open-image-location": () => emit("open-image-location"),
  "open-sticker-folder": () => emit("open-sticker-folder"),
  "open-update": () => emit("open-update"),
  "remind-later": () => emit("remind-later"),
  "rename-sticker": (value) => emit("rename-sticker", value),
  "save-profile": () => emit("save-profile"),
  "submit-password": (value) => emit("submit-password", value),
  "update-now": () => emit("update-now"),
  "update:desktop-preferences": (value) => emit("update:desktop-preferences", value),
  "update:profile-bio": (value) => emit("update:profile-bio", value),
  "update:profile-name": (value) => emit("update:profile-name", value),
  "update:settings": (value) => emit("update:settings", value),
  "upload-avatar": (value) => emit("upload-avatar", value),
};
</script>

<template>
  <ToastStack :notifications="props.store.notifications.value" @dismiss="props.store.dismissNotification" />

  <ChatAppDialogs
    v-bind="props"
    v-on="appDialogListeners"
  />

  <ChatConversationDialogs
    :actions="props.actions"
    :group-management="props.groupManagement"
    :standalone-conversation-mode="props.standaloneConversationMode"
    :store="props.store"
  />
</template>
