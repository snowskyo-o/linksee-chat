<script setup>
import ChatComposer from "./ChatComposer.vue";

defineProps({
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
  downloadProgressText: { type: String, default: "" },
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
  messageInput: { type: String, default: "" },
  pendingFiles: { type: Array, default: () => [] },
  recentStickers: { type: Array, default: () => [] },
  replyText: { type: String, default: "" },
  showReplyBar: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
  stickersHint: { type: String, default: "" },
  stickersHintTone: { type: String, default: "" },
  stickersLoading: { type: Boolean, default: false },
  uploadProgressText: { type: String, default: "" },
  uploadingFiles: { type: Boolean, default: false },
});

defineEmits([
  "cancel-edit",
  "capture-screenshot",
  "clear-recent-stickers",
  "file-change",
  "file-paste",
  "mention-pick",
  "message-keydown",
  "open-file-picker",
  "open-sticker-import",
  "remove-pending-file",
  "retry-pending-file",
  "send-sticker",
  "submit",
  "update:messageInput",
]);
</script>

<template>
  <ChatComposer
    :show-reply-bar="showReplyBar"
    :reply-text="replyText"
    :message-input="messageInput"
    :mention-open="mentionOpen"
    :mention-options="mentionOptions"
    :composer-hint="composerHint"
    :composer-hint-tone="composerHintTone"
    :pending-files="pendingFiles"
    :uploading-files="uploadingFiles"
    :upload-progress-text="uploadProgressText"
    :download-progress-text="downloadProgressText"
    :recent-stickers="recentStickers"
    :stickers="stickers"
    :stickers-loading="stickersLoading"
    :stickers-hint="stickersHint"
    :stickers-hint-tone="stickersHintTone"
    @cancel-edit="$emit('cancel-edit')"
    @update:message-input="$emit('update:messageInput', $event)"
    @message-keydown="$emit('message-keydown', $event)"
    @mention-pick="$emit('mention-pick', $event)"
    @submit="$emit('submit')"
    @open-file-picker="$emit('open-file-picker')"
    @capture-screenshot="$emit('capture-screenshot')"
    @open-sticker-import="$emit('open-sticker-import')"
    @send-sticker="$emit('send-sticker', $event)"
    @clear-recent-stickers="$emit('clear-recent-stickers')"
    @file-change="$emit('file-change', $event)"
    @file-paste="$emit('file-paste', $event)"
    @remove-pending-file="$emit('remove-pending-file', $event)"
    @retry-pending-file="$emit('retry-pending-file', $event)"
  />
</template>
