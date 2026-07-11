<script setup>
import { onMounted } from "vue";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { getAuth, logout } from "../shared/session.js";
import ConversationSidebar from "./components/ConversationSidebar.vue";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";

const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);

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
  <main class="desktop-page-shell list-window-shell">
    <DesktopTitlebar
      app-title="Linksee Chat"
      view-title="会话列表"
      view-meta="双击打开聊天窗口"
    />

    <section class="list-window-body">
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
    </section>
  </main>
</template>
