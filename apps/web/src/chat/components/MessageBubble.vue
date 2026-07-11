<script setup>
defineProps({
  message: { type: Object, required: true },
});

defineEmits(["download-file", "open-menu"]);
</script>

<template>
  <article
    class="message-row"
    :class="{ 'is-me': message.isMe, deleted: message.deletedAt }"
    @contextmenu.prevent="$emit('open-menu', { event: $event, message })"
  >
    <div v-if="!message.isMe" class="message-avatar desktop-message-avatar">
      <img v-if="message.avatarUrl" :src="message.avatarUrl" alt="" />
      <span v-else>{{ message.avatarText }}</span>
    </div>

    <div class="message-bubble-stack">
      <div class="message-head" :class="{ 'message-head-me': message.isMe }">
        <strong>{{ message.senderName }}</strong>
        <span class="muted">{{ message.timeText }}{{ message.editedAt ? " · 已编辑" : "" }}</span>
      </div>
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

    <div v-if="message.isMe" class="message-avatar desktop-message-avatar">
      <img v-if="message.avatarUrl" :src="message.avatarUrl" alt="" />
      <span v-else>{{ message.avatarText }}</span>
    </div>
  </article>
</template>
