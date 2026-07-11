<script setup>
import { computed, onMounted } from "vue";
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { getAuth, logout } from "../shared/session.js";
import ConversationSidebar from "./components/ConversationSidebar.vue";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";

const shell = useDesktopShell();
const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const unreadTotal = computed(() => store.filteredConversations.value.reduce((sum, row) => {
  return sum + Number(row.unreadCount || 0) + Number(row.unreadMentionCount || 0);
}, 0));

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
          <span>聊</span>
          <i v-if="unreadTotal" class="qq-list-badge">{{ unreadTotal > 99 ? "99+" : unreadTotal }}</i>
        </button>
        <button class="qq-list-nav-btn" type="button" title="联系人">
          <span>友</span>
        </button>
      </div>

      <div class="qq-list-nav-bottom">
        <button class="qq-list-nav-btn" type="button" title="刷新" @click="actions.loadConversations">
          <span>刷</span>
        </button>
        <button v-if="shell.isDesktop" class="qq-list-nav-btn" type="button" title="最小化" @click="shell.minimizeWindow">
          <span>一</span>
        </button>
        <button class="qq-list-nav-btn is-danger" type="button" title="退出" @click="logout">
          <span>退</span>
        </button>
      </div>
    </aside>

    <section class="qq-list-panel">
      <header class="qq-list-topbar">
        <div class="qq-list-header-copy">
          <strong>消息</strong>
          <span>{{ unreadTotal ? `未读 ${unreadTotal}` : "双击打开会话窗口" }}</span>
        </div>

        <div v-if="shell.isDesktop" class="qq-list-window-actions">
          <button class="compact-auth-window-btn" type="button" aria-label="最小化" @click="shell.minimizeWindow">-</button>
          <button class="compact-auth-window-btn is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
        </div>
      </header>

      <section class="qq-list-overview">
        <div class="qq-list-profile">
          <div class="qq-list-profile-avatar">
            <img v-if="store.meAvatarUrl.value" :src="store.meAvatarUrl.value" alt="" />
            <span v-else>{{ store.meAvatar.value }}</span>
          </div>
          <div class="qq-list-profile-copy">
            <strong>{{ store.meName.value }}</strong>
            <p>{{ store.meMeta.value }}</p>
          </div>
        </div>

        <div class="qq-list-search-row">
          <input
            :value="store.conversationKeyword.value"
            class="qq-list-search"
            placeholder="搜索"
            @input="store.conversationKeyword.value = $event.target.value"
          />
          <button class="qq-list-add-btn" type="button" @click="actions.loadConversations">+</button>
        </div>
      </section>

      <div class="qq-list-conversations-shell">
        <ConversationSidebar
          list-only
          :me-name="store.meName.value"
          :me-meta="store.meMeta.value"
          :me-avatar="store.meAvatar.value"
          :me-avatar-url="store.meAvatarUrl.value"
          :keyword="store.conversationKeyword.value"
          :conversations="store.filteredConversations.value"
          :selected-id="store.selectedId.value"
          @update:keyword="store.conversationKeyword.value = $event"
          @select="selectConversation"
          @open="openConversation"
          @refresh="actions.loadConversations"
          @logout="logout"
        />
      </div>
    </section>
  </main>
</template>
