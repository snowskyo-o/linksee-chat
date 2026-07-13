<script setup>
import { ref } from "vue";
import { useDesktopShell } from "../../shared/useDesktopShell.js";
import { useChatComposerPanels } from "../composables/useChatComposerPanels.js";
import AttachmentPreview from "./AttachmentPreview.vue";
import ChatComposerEditor from "./ChatComposerEditor.vue";
import ChatComposerToolbar from "./ChatComposerToolbar.vue";
import EmojiPicker from "./EmojiPicker.vue";
import StickerPicker from "./StickerPicker.vue";

const shell = useDesktopShell();

const props = defineProps({
  showReplyBar: { type: Boolean, default: false },
  replyText: { type: String, default: "" },
  messageInput: { type: String, default: "" },
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
  pendingFiles: { type: Array, default: () => [] },
  uploadingFiles: { type: Boolean, default: false },
  uploadProgressText: { type: String, default: "" },
  downloadProgressText: { type: String, default: "" },
  recentStickers: { type: Array, default: () => [] },
  stickers: { type: Array, default: () => [] },
  stickersLoading: { type: Boolean, default: false },
  stickersHint: { type: String, default: "" },
  stickersHintTone: { type: String, default: "" },
});

const emit = defineEmits([
  "cancel-edit", "update:messageInput", "message-keydown", "mention-pick", "submit",
  "open-file-picker", "capture-screenshot", "open-sticker-import", "send-sticker",
  "clear-recent-stickers", "file-change", "file-paste", "remove-pending-file",
]);

const composerEditorRef = ref(null);
const focusComposer = () => composerEditorRef.value?.focusComposer?.();
const { emojiOpen, stickerOpen, toggleEmojiPicker, toggleStickerPicker } = useChatComposerPanels(focusComposer);
const appendEmoji = (emoji) => {
  emit("update:messageInput", `${props.messageInput || ""}${emoji}`);
  emojiOpen.value = false;
  focusComposer();
};
const sendSticker = (sticker) => {
  emit("send-sticker", sticker);
  stickerOpen.value = false;
  focusComposer();
};

function handleComposerPaste(event) {
  const clipboardFiles = Array.from(event.clipboardData?.files || []);
  const files = clipboardFiles.filter((file) => String(file.type || "").startsWith("image/"));
  if (!files.length) return void (clipboardFiles.length ? event.preventDefault() : undefined);
  event.preventDefault();
  emit("file-paste", { files, ignoredClipboardFiles: Math.max(0, clipboardFiles.length - files.length) });
}
</script>

<template>
  <div v-if="showReplyBar" class="reply-bar">{{ replyText }}</div>

  <form class="composer desktop-composer" @submit.prevent="$emit('submit')">
    <input class="hidden" type="file" multiple @change="$emit('file-change', $event)" />
    <ChatComposerToolbar
      :shell="shell"
      :show-reply-bar="showReplyBar"
      :uploading-files="uploadingFiles"
      :upload-progress-text="uploadProgressText"
      :download-progress-text="downloadProgressText"
      @cancel-edit="$emit('cancel-edit')"
      @toggle-emoji="toggleEmojiPicker"
      @toggle-sticker="toggleStickerPicker"
      @capture-screenshot="$emit('capture-screenshot')"
      @open-file-picker="$emit('open-file-picker')"
    />

    <EmojiPicker :open="emojiOpen" @pick="appendEmoji" />
    <StickerPicker
      :open="stickerOpen"
      :recent-stickers="recentStickers"
      :stickers="stickers"
      :loading="stickersLoading"
      :hint="stickersHint"
      :hint-tone="stickersHintTone"
      :desktop-mode="shell.isDesktop"
      @pick="sendSticker"
      @import-files="$emit('open-sticker-import')"
      @clear-recent="$emit('clear-recent-stickers')"
    />

    <AttachmentPreview :files="pendingFiles" @remove="$emit('remove-pending-file', $event)" />

    <ChatComposerEditor
      ref="composerEditorRef"
      :message-input="messageInput"
      :mention-open="mentionOpen"
      :mention-options="mentionOptions"
      :composer-hint="composerHint"
      :composer-hint-tone="composerHintTone"
      @update:message-input="$emit('update:messageInput', $event)"
      @message-keydown="$emit('message-keydown', $event)"
      @file-paste="handleComposerPaste"
      @mention-pick="$emit('mention-pick', $event)"
    />
  </form>
</template>
