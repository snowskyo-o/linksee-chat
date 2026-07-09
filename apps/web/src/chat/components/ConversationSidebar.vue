<script setup>
defineProps({
  meName: { type: String, default: "未登录" },
  meMeta: { type: String, default: "--" },
  meAvatar: { type: String, default: "ME" },
  meAvatarUrl: { type: String, default: "" },
  keyword: { type: String, default: "" },
  conversations: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
});

defineEmits([
  "update:keyword",
  "select",
  "refresh",
  "new-direct",
  "new-group",
  "logout",
  "toggle-pin",
]);
</script>

<template>
  <aside class="qq-sidebar">
    <div class="qq-user-card">
      <div class="qq-avatar">
        <img v-if="meAvatarUrl" :src="meAvatarUrl" alt="" />
        <span v-else>{{ meAvatar }}</span>
      </div>
      <div class="qq-user-meta">
        <strong>{{ meName }}</strong>
        <span class="muted">{{ meMeta }}</span>
      </div>
      <button class="ghost-btn" type="button" @click="$emit('logout')">退出</button>
    </div>

    <div class="qq-tools">
      <input
        :value="keyword"
        class="qq-search"
        placeholder="搜索会话"
        @input="$emit('update:keyword', $event.target.value)"
      />
      <button class="ghost-btn" type="button" @click="$emit('new-direct')">新私聊</button>
      <button class="ghost-btn" type="button" @click="$emit('new-group')">新群聊</button>
      <button class="ghost-btn" type="button" @click="$emit('refresh')">刷新</button>
    </div>

    <div class="conversation-list">
      <div v-if="!conversations.length" class="empty-state">没有匹配的会话。</div>
      <article
        v-for="row in conversations"
        :key="row.id"
        class="conversation-item"
        :class="{ 'is-active': row.id === selectedId }"
        @click="$emit('select', row.id)"
      >
        <div class="conversation-avatar">
          <img v-if="row.avatarUrl" :src="row.avatarUrl" alt="" />
          <span v-else>{{ (row.title || row.roomKey || "?").slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="conversation-copy">
          <div class="conversation-item-head">
            <strong>{{ row.title || row.roomKey }}</strong>
            <div class="conversation-item-meta">
              <span v-if="row.pinnedAt" class="badge ghost">置顶</span>
              <span v-if="row.unreadCount" class="badge">{{ row.unreadCount }}</span>
              <span v-if="row.unreadMentionCount" class="badge ghost">@{{ row.unreadMentionCount }}</span>
              <button
                class="message-link"
                type="button"
                @click.stop="$emit('toggle-pin', row.id)"
              >
                {{ row.pinnedAt ? "取消置顶" : "置顶" }}
              </button>
            </div>
          </div>
          <p class="muted">{{ row.kind || "group" }} · {{ row.roomKey || "" }}</p>
          <p>{{ row.preview }}</p>
        </div>
      </article>
    </div>
  </aside>
</template>
