<script setup>
import ListSearchPanel from "./ListSearchPanel.vue";
import QuickCreateMenu from "./QuickCreateMenu.vue";

defineProps({
  activePane: { type: String, default: "messages" },
  contactCount: { type: Number, default: 0 },
  conversationCount: { type: Number, default: 0 },
  favoriteCount: { type: Number, default: 0 },
  friendRequestTotal: { type: Number, default: 0 },
  keyword: { type: String, default: "" },
  meName: { type: String, default: "未登录" },
  quickCreateOpen: { type: Boolean, default: false },
  searchActiveKey: { type: String, default: "" },
  searchFocused: { type: Boolean, default: false },
  searchKeyword: { type: String, default: "" },
  searchPanelOpen: { type: Boolean, default: false },
  recentKeywords: { type: Array, default: () => [] },
  searchSections: { type: Array, default: () => [] },
  shell: { type: Object, required: true },
});

defineEmits([
  "update:keyword", "open-direct", "open-group", "toggle-quick-create", "focus-search",
  "search-keydown", "clear-search", "search-pick", "clear-recent", "recent-pick",
  "search-footer-pick", "open-settings",
]);

function paneCountText(activePane, conversationCount, contactCount, favoriteCount) {
  if (activePane === "messages") return `${conversationCount} 个会话`;
  if (activePane === "contacts") return `${contactCount} 位联系人`;
  return `${favoriteCount} 条收藏`;
}

function panePlaceholder(activePane) {
  if (activePane === "messages") return "搜索会话、联系人、消息";
  if (activePane === "contacts") return "搜索联系人";
  return "搜索收藏消息";
}
</script>

<template>
  <section class="qq-list-overview">
    <header class="qq-list-topbar">
      <div class="qq-list-profile-copy">
        <div class="qq-list-profile-line">
          <strong>{{ meName }}</strong>
          <span class="qq-list-status-pill">在线</span>
          <span class="qq-list-status-pill is-muted">
            {{ paneCountText(activePane, conversationCount, contactCount, favoriteCount) }}
          </span>
        </div>
      </div>

      <div v-if="shell.isDesktop" class="qq-list-window-actions">
        <button class="compact-auth-window-btn compact-auth-window-btn-light" type="button" aria-label="最小化" @click="shell.minimizeWindow">─</button>
        <button class="compact-auth-window-btn compact-auth-window-btn-light is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
      </div>
    </header>

    <div class="qq-list-search-row">
      <div class="qq-list-search-cluster">
        <label class="qq-list-search-box">
          <input
            :value="keyword"
            class="qq-list-search"
            :placeholder="panePlaceholder(activePane)"
            @focus="$emit('focus-search')"
            @input="$emit('update:keyword', $event.target.value)"
            @keydown="$emit('search-keydown', $event)"
          />
          <button
            v-if="keyword"
            class="qq-list-search-clear"
            type="button"
            aria-label="清空搜索"
            @click="$emit('clear-search')"
          >
            <svg viewBox="0 0 24 24"><path d="m12 10.59 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41L12 10.59Z"/></svg>
          </button>
          <span class="qq-list-search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
          </span>
        </label>

        <div class="qq-plus-action-wrap">
          <button class="qq-plus-action-btn" type="button" title="添加好友或创建群聊" @click="$emit('toggle-quick-create')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>
            <i v-if="friendRequestTotal" class="qq-plus-action-badge">
              {{ friendRequestTotal > 9 ? "9+" : friendRequestTotal }}
            </i>
          </button>
          <QuickCreateMenu :open="quickCreateOpen" @direct="$emit('open-direct')" @group="$emit('open-group')" />
        </div>
      </div>

      <ListSearchPanel
        :open="searchPanelOpen"
        :keyword="searchKeyword"
        :recent-keywords="recentKeywords"
        :sections="searchSections"
        :active-key="searchActiveKey"
        @pick="$emit('search-pick', $event)"
        @clear-recent="$emit('clear-recent')"
        @recent-pick="$emit('recent-pick', $event)"
        @footer-pick="$emit('search-footer-pick', $event)"
      />
    </div>
  </section>
</template>
