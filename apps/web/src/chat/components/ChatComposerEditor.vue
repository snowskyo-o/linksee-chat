<script setup>
import { nextTick, ref } from "vue";
import ChatComposerFooter from "./ChatComposerFooter.vue";
import ChatComposerMentionPanel from "./ChatComposerMentionPanel.vue";

defineProps({
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
  messageInput: { type: String, default: "" },
});

defineEmits(["update:messageInput", "message-keydown", "file-paste", "mention-pick"]);

const textareaRef = ref(null);

defineExpose({
  focusComposer() {
    nextTick(() => textareaRef.value?.focus());
  },
});
</script>

<template>
  <textarea
    ref="textareaRef"
    :value="messageInput"
    class="message-input desktop-message-input"
    rows="4"
    placeholder="输入消息，Enter 发送，Shift+Enter 换行，@ 可提及成员"
    @input="$emit('update:messageInput', $event.target.value)"
    @keydown="$emit('message-keydown', $event)"
    @paste="$emit('file-paste', $event)"
  ></textarea>

  <ChatComposerMentionPanel
    :mention-open="mentionOpen"
    :mention-options="mentionOptions"
    @pick="$emit('mention-pick', $event)"
  />

  <ChatComposerFooter
    :composer-hint="composerHint"
    :composer-hint-tone="composerHintTone"
    @clear="$emit('update:messageInput', '')"
  />
</template>
