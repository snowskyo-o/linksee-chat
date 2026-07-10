<script setup>
defineProps({
  message: { type: Object, required: true },
});

defineEmits(["action", "download-file"]);
</script>

<template>
  <article class="message-row" :class="{ 'is-me': message.isMe, deleted: message.deletedAt }">
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
          <div v-for="file in message.files" :key="file.objectKey" class="file-card" :class="{ expired: file.expired }">
            <div class="file-card-main">
              <strong>{{ file.name }}</strong>
              <span class="muted">{{ file.metaText }}</span>
            </div>
            <span class="file-expiry" :class="{ expired: file.expired }">{{ file.expiryText }}</span>
          </div>
        </div>
      </div>

      <div class="message-actions" :class="{ 'message-actions-me': message.isMe }">
        <button class="message-link" type="button" @click="$emit('action', { id: message.id, action: 'reply' })">回复</button>
        <button
          v-if="message.canEdit"
          class="message-link"
          type="button"
          @click="$emit('action', { id: message.id, action: 'edit' })"
        >
          编辑
        </button>
        <button
          v-if="message.canRecall"
          class="message-link"
          type="button"
          @click="$emit('action', { id: message.id, action: 'recall' })"
        >
          撤回
        </button>
        <template v-if="message.isFileMessage">
          <button
            v-for="file in message.files"
            :key="file.objectKey"
            class="message-link"
            type="button"
            :disabled="file.expired || !file.downloadPath"
            @click="$emit('download-file', file)"
          >
            {{ file.expired ? `${file.name} 已过期` : `下载 ${file.name}` }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="message.isMe" class="message-avatar desktop-message-avatar">
      <img v-if="message.avatarUrl" :src="message.avatarUrl" alt="" />
      <span v-else>{{ message.avatarText }}</span>
    </div>
  </article>
</template>
