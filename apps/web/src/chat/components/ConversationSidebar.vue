<script setup>
import AvatarImage from "../../shared/components/AvatarImage.vue";

function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

defineProps({
  meName: { type: String, default: "未登录" },
  meMeta: { type: String, default: "" },
  meAvatar: { type: String, default: "ME" },
  meAvatarUrl: { type: String, default: "" },
  keyword: { type: String, default: "" },
  conversations: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
  listOnly: { type: Boolean, default: false },
});

defineEmits([
  "update:keyword",
  "select",
  "open",
  "refresh",
  "new-direct",
  "new-group",
  "logout",
  "toggle-pin",
]);
</script>

<template>
  <aside class="chat-rail">
    <div class="chat-rail-header">
      <div class="qq-avatar user-avatar-large">
        <AvatarImage :src="meAvatarUrl" alt="">
          <span>{{ meAvatar }}</span>
        </AvatarImage>
      </div>
      <div class="chat-rail-user-copy">
        <strong>{{ meName }}</strong>
        <p>{{ meMeta }}</p>
      </div>
      <button class="ghost-btn compact-btn" type="button" @click="$emit('logout')">退出</button>
    </div>

    <div class="chat-rail-toolbar">
      <input
        :value="keyword"
        class="qq-search"
        placeholder="搜索会话"
        @input="$emit('update:keyword', $event.target.value)"
      />
      <div v-if="!listOnly" class="chat-rail-actions">
        <button class="ghost-btn compact-btn" type="button" @click="$emit('new-direct')">私聊</button>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('new-group')">群聊</button>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('refresh')">刷新</button>
      </div>
      <button v-else class="ghost-btn compact-btn" type="button" @click="$emit('refresh')">刷新列表</button>
    </div>

    <div class="conversation-list desktop-conversation-list">
      <div v-if="!conversations.length" class="empty-state">暂无会话</div>
      <article
        v-for="row in conversations"
        :key="row.id"
        class="conversation-item desktop-conversation-item"
        :class="{ 'is-active': row.id === selectedId }"
        @click="$emit('select', row.id)"
        @dblclick="$emit('open', row.id)"
      >
        <div class="conversation-avatar">
          <AvatarImage :src="row.avatarUrl" alt="">
            <span>{{ (row.displayTitle || "?").slice(0, 2).toUpperCase() }}</span>
          </AvatarImage>
        </div>
        <div class="conversation-copy">
          <div class="conversation-item-head">
            <strong>{{ row.displayTitle }}</strong>
            <div class="conversation-item-meta">
              <span class="conversation-time">{{ formatConversationTime(row.updatedAt || row.lastMessage?.createdAt) }}</span>
              <span v-if="row.unreadMentionCount" class="badge mention-badge">@{{ row.unreadMentionCount }}</span>
              <span v-else-if="row.unreadCount" class="badge">{{ row.unreadCount }}</span>
            </div>
          </div>
          <p v-if="!listOnly" class="conversation-subtitle">{{ row.displaySubtitle }}</p>
          <p class="conversation-preview">{{ row.preview }}</p>
        </div>
        <span v-if="row.pinnedAt" class="conversation-pin-dot" aria-hidden="true"></span>
      </article>
    </div>
  </aside>
</template>
