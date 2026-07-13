<script setup>
import { useDesktopShell } from "../shared/useDesktopShell.js";
import { getAuth, logout } from "../shared/session.js";
import ConversationListPageDialogs from "./components/ConversationListPageDialogs.vue";
import ConversationListWorkspace from "./components/ConversationListWorkspace.vue";
import { useChatActions } from "./composables/useChatActions.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";
import { useConversationListRuntime } from "./composables/useConversationListRuntime.js";
import { useFriendCenter } from "./composables/useFriendCenter.js";
import { usePasswordChange } from "./composables/usePasswordChange.js";
import { useChatStore } from "./store/useChatStore.js";

const shell = useDesktopShell();
const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const passwordChange = usePasswordChange();
let runtime = null;
const realtime = useChatRealtime(
  auth,
  store.selectedId,
  store.conversations,
  store.socketOnline,
  (event) => runtime?.handleRealtimeEvent?.(event),
);
const friendCenter = useFriendCenter(store, {
  async onChanged() {
    await actions.loadContacts().catch(() => {});
    await actions.loadConversations().catch(() => {});
  },
});
const selectConversation = (id) => {
  store.selectedId.value = id;
};

runtime = useConversationListRuntime({
  auth,
  store,
  actions,
  realtime,
  shell,
  friendCenter,
  selectConversation,
});
</script>

<template>
  <main class="qq-list-shell">
    <ConversationListWorkspace
      :store="store"
      :actions="actions"
      :runtime="runtime"
      :shell="shell"
      :friend-center="friendCenter"
      @logout="logout"
    />

    <ConversationListPageDialogs
      :store="store"
      :actions="actions"
      :runtime="runtime"
      :friend-center="friendCenter"
      :password-change="passwordChange"
      :auth="auth"
      :app-settings="runtime.appSettings.value"
      :desktop-preferences="runtime.desktopPreferences.value"
      :app-info="runtime.appInfo.value"
      @logout="logout"
    />
  </main>
</template>
