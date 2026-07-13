<script setup>
import { ref } from "vue";
import { useDesktopShell } from "../../shared/useDesktopShell.js";
import { useChatComposerPanels } from "../composables/useChatComposerPanels.js";
import AttachmentPreview from "./AttachmentPreview.vue";
import ChatComposerEditor from "./ChatComposerEditor.vue";
import ChatComposerToolbar from "./ChatComposerToolbar.vue";
import EmojiPicker from "./EmojiPicker.vue";
import StickerPicker from "./StickerPicker.vue";
import { chatComposerEmits, chatComposerProps } from "./chat-composer-contract.js";
import { handleComposerPaste } from "./chat-composer-paste.js";

const shell = useDesktopShell();
const props = defineProps(chatComposerProps);
const emit = defineEmits(chatComposerEmits);

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

    <AttachmentPreview
      :files="pendingFiles"
      :uploading-files="uploadingFiles"
      @remove="$emit('remove-pending-file', $event)"
      @retry="$emit('retry-pending-file', $event)"
    />

    <ChatComposerEditor
      ref="composerEditorRef"
      :message-input="messageInput"
      :mention-open="mentionOpen"
      :mention-options="mentionOptions"
      :composer-hint="composerHint"
      :composer-hint-tone="composerHintTone"
      @update:message-input="$emit('update:messageInput', $event)"
      @message-keydown="$emit('message-keydown', $event)"
      @file-paste="handleComposerPaste($event, emit)"
      @mention-pick="$emit('mention-pick', $event)"
    />
  </form>
</template>
