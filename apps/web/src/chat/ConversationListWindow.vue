<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import AvatarImage from "../shared/components/AvatarImage.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { clearAppLogs, onAppLogsUpdated, readAppLogs } from "../shared/app-log.js";
import { getAuth, logout } from "../shared/session.js";
import { loadAppSettings, saveAppSettings } from "../shared/app-settings.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";

const shell = useDesktopShell();
const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const settingsOpen = ref(false);
const appSettings = ref(loadAppSettings());
const appLogs = ref(readAppLogs());
const appInfo = ref({
  productName: "Linksee Chat",
  version: "",
  electron: window.desktopShell?.versions?.electron || "",
  chrome: window.desktopShell?.versions?.chrome || "",
  node: window.desktopShell?.versions?.node || "",
});
const activePane = ref("messages");
const unreadTotal = computed(() => store.filteredConversations.value.reduce((sum, row) => {
  return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
}, 0));
const filteredFavorites = computed(() => {
  const keyword = store.conversationKeyword.value.trim().toLowerCase();
  return store.favoriteMessages.value.filter((item) => {
    if (!keyword) return true;
    return [item.conversationTitle, item.senderName, item.content]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });
});
let detachLogs = null;

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

async function openFavorite(item) {
  if (!item?.conversationId) return;
  activePane.value = "messages";
  await openConversation(item.conversationId);
}

function removeFavorite(item) {
  store.removeFavoriteMessage(item?.id);
}

function persistSettings(nextSettings) {
  appSettings.value = saveAppSettings(nextSettings);
}

function handleAvatarUpload(event) {
  actions.uploadAvatar(event.target?.files?.[0]).catch((error) => {
    store.profileHint.value = error?.message || "头像上传失败";
    store.profileHintTone.value = "error";
  });
}

onMounted(async () => {
  detachLogs = onAppLogsUpdated((logs) => {
    appLogs.value = logs;
  });
  const runtimeInfo = await window.desktopShell?.getAppInfo?.().catch(() => null);
  if (runtimeInfo) {
    appInfo.value = {
      productName: runtimeInfo.productName || "Linksee Chat",
      version: runtimeInfo.version || "",
      electron: runtimeInfo.electron || appInfo.value.electron,
      chrome: runtimeInfo.chrome || appInfo.value.chrome,
      node: runtimeInfo.node || appInfo.value.node,
    };
  }
  await actions.loadProfile(auth);
  await actions.loadContacts();
  await actions.loadConversations();
});

onBeforeUnmount(() => {
  if (typeof detachLogs === "function") detachLogs();
});
</script>

<template>
  <main class="qq-list-shell">
    <aside class="qq-list-nav">
      <div class="qq-list-nav-top">
        <div class="qq-list-drag">
          <div class="qq-list-avatar">
            <AvatarImage :src="store.meAvatarUrl.value" alt="">
              <span>{{ store.meAvatar.value }}</span>
            </AvatarImage>
          </div>
        </div>

        <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'messages' }" type="button" title="消息" @click="activePane = 'messages'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v7.17L8.4 15H19V7H5Z"/></svg>
          <i v-if="unreadTotal" class="qq-list-badge">{{ unreadTotal > 99 ? "99+" : unreadTotal }}</i>
        </button>
        <button class="qq-list-nav-btn" type="button" title="联系人">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" :class="{ 'is-active': activePane === 'favorites' }" type="button" title="收藏" @click="activePane = 'favorites'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 17.27 4.95 2.99-1.32-5.63L20 10.5l-5.76-.49L12 4.7l-2.24 5.31L4 10.5l4.37 4.13-1.32 5.63L12 17.27Z"/></svg>
        </button>
        <button class="qq-list-nav-btn" type="button" title="设置" @click="settingsOpen = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.18 7.18 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.65 8.84a.5.5 0 0 0 .12.64L4.8 11.06c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.41 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>
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
              <span class="qq-list-status-pill is-muted">
                {{ activePane === "messages" ? `${store.filteredConversations.value.length} 个会话` : `${filteredFavorites.length} 条收藏` }}
              </span>
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
              :placeholder="activePane === 'messages' ? '搜索会话' : '搜索收藏消息'"
              @input="store.conversationKeyword.value = $event.target.value"
            />
            <span class="qq-list-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
            </span>
          </label>
        </div>
      </section>

      <div class="qq-list-conversations-shell">
        <div v-if="activePane === 'messages'" class="qq-thread-list">
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
              <AvatarImage :src="row.avatarUrl" alt="">
                <span>{{ (row.displayTitle || "?").slice(0, 2).toUpperCase() }}</span>
              </AvatarImage>
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
        <div v-else class="qq-thread-list">
          <div v-if="!filteredFavorites.length" class="empty-state">暂无收藏消息</div>
          <article
            v-for="item in filteredFavorites"
            :key="`${item.id}:${item.conversationId}`"
            class="qq-thread-item is-favorite"
            @dblclick="openFavorite(item)"
          >
            <div class="qq-thread-avatar is-favorite">
              <span>★</span>
            </div>

            <div class="qq-thread-copy">
              <div class="qq-thread-head">
                <strong>{{ item.conversationTitle }}</strong>
                <div class="qq-thread-favorite-meta">
                  <span class="qq-thread-time">{{ formatConversationTime(item.createdAt) }}</span>
                  <button class="qq-thread-favorite-remove" type="button" @click.stop="removeFavorite(item)">移除</button>
                </div>
              </div>
              <p class="qq-thread-subtitle">{{ item.senderName }}</p>
              <div class="qq-thread-preview-row">
                <p class="qq-thread-preview">{{ item.content }}</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <SettingsDialog
      :open="settingsOpen"
      :settings="appSettings"
      :profile-name="store.profileName.value"
      :profile-bio="store.profileBio.value"
      :profile-hint="store.profileHint.value"
      :profile-hint-tone="store.profileHintTone.value"
      :me-avatar-url="store.meAvatarUrl.value"
      :app-info="appInfo"
      :logs="appLogs"
      @close="settingsOpen = false"
      @clear-logs="clearAppLogs()"
      @update:settings="persistSettings"
      @update:profile-name="store.profileName.value = $event"
      @update:profile-bio="store.profileBio.value = $event"
      @save-profile="actions.saveProfile"
      @upload-avatar="handleAvatarUpload"
    />
  </main>
</template>
