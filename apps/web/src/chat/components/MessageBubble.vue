<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";
import MessageAttachmentCard from "./MessageAttachmentCard.vue";

defineProps({
  message: { type: Object, required: true },
});

defineEmits(["download-file", "open-image", "open-menu", "retry"]);
</script>

<template>
  <article v-if="message.isSystemNote" class="message-system-row">
    <span class="message-system-line"></span>
    <span class="message-system-text">{{ message.systemText }}</span>
    <span class="message-system-line"></span>
  </article>

  <article
    v-else
    class="message-row"
    :class="{ 'is-me': message.isMe }"
    @contextmenu.prevent="$emit('open-menu', { event: $event, message })"
  >
    <div class="message-avatar desktop-message-avatar">
      <AvatarImage :src="message.avatarUrl" alt="">
        <span>{{ message.avatarText }}</span>
      </AvatarImage>
    </div>

    <div class="message-head" :class="{ 'message-head-me': message.isMe }">
      <strong>{{ message.senderName }}</strong>
      <span class="muted">
        <span v-if="message.isFavorite" class="message-favorite-mark">★</span>
        {{ message.timeText }}{{ message.editedAt ? " · 已编辑" : "" }}{{ message.statusText ? ` · ${message.statusText}` : "" }}
      </span>
    </div>

    <div class="message-bubble-shell" :class="{ 'message-bubble-shell-me': message.isMe }">
      <span
        v-if="message.operationState === 'sending' && message.isMe"
        class="message-sending-indicator"
        aria-label="发送中"
        title="发送中"
      ></span>

      <button
        v-if="message.canRetry && message.isMe"
        class="message-retry-btn"
        type="button"
        @click.stop="$emit('retry', message.id)"
      >
        重试
      </button>

      <div v-if="message.hasTextContent || message.replyToText" class="message-bubble" :class="{ 'message-bubble-me': message.isMe }">
        <div v-if="message.replyToText" class="reply-quote">{{ message.replyToText }}</div>
        <div class="message-content" v-html="message.html"></div>
      </div>

      <div v-if="message.isFileMessage" class="message-attachment-list" :class="{ 'is-me': message.isMe }">
        <MessageAttachmentCard
          v-for="file in message.files"
          :key="file.objectKey"
          :file="file"
          :is-me="message.isMe"
          @download="$emit('download-file', $event)"
          @open-image="$emit('open-image', $event)"
        />
      </div>
    </div>
  </article>
</template>
