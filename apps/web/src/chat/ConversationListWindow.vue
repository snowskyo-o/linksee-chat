<script setup>
import { computed, onMounted } from "vue";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { getAuth, logout } from "../shared/session.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";

const shell = useDesktopShell();
const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const unreadTotal = computed(() => store.filteredConversations.value.reduce((sum, row) => {
  return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
}, 0));

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

function selectConversation(id) {
  store.selectedId.value = id;
}

async function openConversation(id) {
  store.selectedId.value = id;
  if (typeof window.desktopShell?.openChatWindow === "function") {
    await window.desktopShell.openChatWindow(id);
  }
}

onMounted(async () => {
  await actions.loadProfile(auth);
  await actions.loadContacts();
  await actions.loadConversations();
});
</script>

<template>
  <main class="qq-list-shell">
    <aside class="qq-list-nav">
      <div class="qq-list-nav-top">
        <div class="qq-list-drag">
          <div class="qq-list-avatar">
            <img v-if="store.meAvatarUrl.value" :src="store.meAvatarUrl.value" alt="" />
            <span v-else>{{ store.meAvatar.value }}</span>
          </div>
        </div>

        <button class="qq-list-nav-btn is-active" type="button" title="消息">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v7.17L8.4 15H19V7H5Z"/></svg>
          <i v-if="unreadTotal" class="qq-list-badge">{{ unreadTotal > 99 ? "99+" : unreadTotal }}</i>
        </button>
        <button class="qq-list-nav-btn" type="button" title="联系人">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" type="button" title="收藏">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.27 4.95 2.99-1.32-5.63L20 10.5l-5.76-.49L12 4.7l-2.24 5.31L4 10.5l4.37 4.13-1.32 5.63L12 17.27Z"/></svg>
        </button>
      </div>

      <div class="qq-list-nav-bottom">
        <button class="qq-list-nav-btn is-danger" type="button" title="退出" @click="logout">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 17v-2h5V9h-5V7h7v10h-7Zm-1-1-5-4 5-4v3h5v2H9v3Z"/></svg>
        </button>
      </div>
    </aside>

    <section class="qq-list-panel">
      <section class="qq-list-overview">
        <header class="qq-list-topbar">
          <div class="qq-list-profile-copy">
            <div class="qq-list-profile-line">
              <strong>{{ store.meName.value }}</strong>
              <span class="qq-list-status-pill">在线</span>
              <span class="qq-list-status-pill is-muted">{{ store.filteredConversations.value.length }} 个会话</span>
            </div>
          </div>

          <div v-if="shell.isDesktop" class="qq-list-window-actions">
            <button class="compact-auth-window-btn compact-auth-window-btn-light" type="button" aria-label="最小化" @click="shell.minimizeWindow">─</button>
            <button class="compact-auth-window-btn compact-auth-window-btn-light is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
          </div>
        </header>

        <div class="qq-list-search-row">
          <label class="qq-list-search-box">
            <input
              :value="store.conversationKeyword.value"
              class="qq-list-search"
              placeholder="搜索会话"
              @input="store.conversationKeyword.value = $event.target.value"
            />
            <span class="qq-list-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
            </span>
          </label>
        </div>
      </section>

      <div class="qq-list-conversations-shell">
        <div class="qq-thread-list">
          <div v-if="!store.filteredConversations.value.length" class="empty-state">暂无会话</div>
          <article
            v-for="row in store.filteredConversations.value"
            :key="row.id"
            class="qq-thread-item"
            :class="{ 'is-active': row.id === store.selectedId.value }"
            @click="selectConversation(row.id)"
            @dblclick="openConversation(row.id)"
          >
            <div class="qq-thread-avatar">
              <img v-if="row.avatarUrl" :src="row.avatarUrl" alt="" />
              <span v-else>{{ (row.displayTitle || "?").slice(0, 2).toUpperCase() }}</span>
            </div>

            <div class="qq-thread-copy">
              <div class="qq-thread-head">
                <strong>{{ row.displayTitle }}</strong>
                <span class="qq-thread-time">{{ formatConversationTime(row.updatedAt || row.lastMessage?.createdAt) }}</span>
              </div>

              <p class="qq-thread-subtitle">{{ row.kind === "group" ? "群聊" : "单聊" }}</p>
              <div class="qq-thread-preview-row">
                <p class="qq-thread-preview">{{ row.preview }}</p>
                <span v-if="row.unreadMentionCount" class="badge mention-badge">@{{ row.unreadMentionCount }}</span>
                <span v-else-if="row.unreadCount" class="badge">{{ row.unreadCount }}</span>
              </div>
            </div>

            <span v-if="row.pinnedAt" class="conversation-pin-dot" aria-hidden="true"></span>
          </article>
        </div>
      </div>
    </section>
  </main>
</template>
