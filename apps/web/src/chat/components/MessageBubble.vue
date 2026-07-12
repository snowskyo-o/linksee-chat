<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

defineProps({
  message: { type: Object, required: true },
});

defineEmits(["download-file", "open-menu", "retry"]);
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
      <span class="muted">{{ message.timeText }}{{ message.editedAt ? " · 已编辑" : "" }}{{ message.statusText ? ` · ${message.statusText}` : "" }}</span>
    </div>

    <div class="message-bubble-shell" :class="{ 'message-bubble-shell-me': message.isMe }">
      <button
        v-if="message.canRetry && message.isMe"
        class="message-retry-btn"
        type="button"
        @click.stop="$emit('retry', message.id)"
      >
        重试
      </button>

      <div class="message-bubble" :class="{ 'message-bubble-me': message.isMe }">
        <div v-if="message.replyToText" class="reply-quote">{{ message.replyToText }}</div>
        <div class="message-content" v-html="message.html"></div>

        <div v-if="message.isFileMessage" class="file-list">
          <button
            v-for="file in message.files"
            :key="file.objectKey"
            class="file-card"
            :class="{ expired: file.expired, clickable: !file.expired }"
            type="button"
            :disabled="file.expired"
            @click="$emit('download-file', file)"
          >
            <div class="file-card-main">
              <strong>{{ file.name }}</strong>
              <span class="muted">{{ file.metaText }}</span>
            </div>
            <span class="file-expiry" :class="{ expired: file.expired }">{{ file.expiryText }}</span>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>
