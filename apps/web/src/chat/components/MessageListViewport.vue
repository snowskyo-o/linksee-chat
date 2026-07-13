<script setup>
import { ref } from "vue";
import MessageBubble from "./MessageBubble.vue";
import StatePanel from "./StatePanel.vue";

const props = defineProps({
  hasConversation: { type: Boolean, default: false },
  hasMoreMessages: { type: Boolean, default: false },
  loadState: { type: Object, default: () => ({ status: "idle", message: "" }) },
  loadingMoreMessages: { type: Boolean, default: false },
  messages: { type: Array, default: () => [] },
  pendingIncomingCount: { type: Number, default: 0 },
});

const emit = defineEmits([
  "copy-image",
  "download-file",
  "load-more",
  "message-action",
  "open-file",
  "open-file-location",
  "open-image",
  "open-menu",
  "retry-load",
  "save-file-as",
  "scroll-to-bottom",
]);

function getListElement() {
  return listRef.value;
}

const listRef = ref(null);

defineExpose({
  getListElement,
});
</script>

<template>
  <div ref="listRef" class="message-list desktop-message-list">
    <button
      v-if="hasMoreMessages"
      class="ghost-btn load-more-btn compact-btn"
      type="button"
      :disabled="loadingMoreMessages"
      @click="$emit('load-more')"
    >
      {{ loadingMoreMessages ? "加载中..." : "查看更多消息" }}
    </button>
    <StatePanel
      v-if="!hasConversation"
      title="暂无会话"
      message="选择一个联系人开始聊天"
    />
    <StatePanel
      v-else-if="!messages.length && loadState?.status === 'error'"
      title="加载失败，请重试"
      :message="loadState?.message || '暂时无法获取聊天内容'"
      action-text="重新加载"
      @action="$emit('retry-load')"
    />
    <div v-else-if="!messages.length" class="empty-state">这里还没有消息，发一条开始吧。</div>
    <MessageBubble
      v-for="message in messages"
      :key="message.id"
      :message="message"
      @copy-image="$emit('copy-image', $event)"
      @delete="$emit('message-action', { id: $event, action: 'delete' })"
      @download-file="$emit('download-file', $event)"
      @forward="$emit('message-action', { id: $event, action: 'forward' })"
      @save-file-as="$emit('save-file-as', $event)"
      @open-image="$emit('open-image', $event)"
      @open-file="$emit('open-file', $event)"
      @open-file-location="$emit('open-file-location', $event)"
      @open-menu="$emit('open-menu', $event)"
      @retry="$emit('message-action', { id: $event, action: 'retry' })"
    />
    <button
      v-if="pendingIncomingCount"
      class="new-message-indicator"
      type="button"
      @click="$emit('scroll-to-bottom')"
    >
      <span class="new-message-indicator__count">{{ pendingIncomingCount }}</span>
      <span>新消息</span>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 14.25 4.75 9l1.5-1.5 2.75 2.75V4.5h2v5.75L13.75 7.5l1.5 1.5L10 14.25Z"/>
      </svg>
    </button>
  </div>
</template>
