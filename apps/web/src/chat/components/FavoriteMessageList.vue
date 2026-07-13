<script setup>
import { buildFavoriteMessagePreview } from "../store/chat-store-derived-utils.js";

defineProps({
  favorites: { type: Array, default: () => [] },
  formatTime: { type: Function, required: true },
});

defineEmits(["open-favorite", "remove-favorite"]);
</script>

<template>
  <div class="qq-thread-list">
    <div v-if="!favorites.length" class="empty-state">暂无收藏消息</div>
    <article
      v-for="item in favorites"
      :key="`${item.id}:${item.conversationId}`"
      class="qq-thread-item is-favorite"
      @dblclick="$emit('open-favorite', item)"
    >
      <div class="qq-thread-avatar is-favorite">
        <span>★</span>
      </div>

      <div class="qq-thread-copy">
        <div class="qq-thread-head">
          <strong>{{ item.conversationTitle }}</strong>
          <div class="qq-thread-favorite-meta">
            <span class="qq-thread-time">{{ formatTime(item.createdAt) }}</span>
            <button class="qq-thread-favorite-remove" type="button" @click.stop="$emit('remove-favorite', item)">移除</button>
          </div>
        </div>
        <p class="qq-thread-subtitle">{{ item.senderName }}</p>
        <div class="qq-thread-preview-row">
          <p class="qq-thread-preview">{{ buildFavoriteMessagePreview(item) }}</p>
        </div>
      </div>
    </article>
  </div>
</template>
