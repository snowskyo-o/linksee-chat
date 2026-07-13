<script setup>
import { computed } from "vue";
import ChatPageDialogs from "./components/ChatPageDialogs.vue";
import ChatPageWorkspace from "./components/ChatPageWorkspace.vue";
import DesktopTitlebar from "../shared/components/DesktopTitlebar.vue";
import { getAuth, logout } from "../shared/session.js";
import { getDesktopConversationId, getDesktopWindowKind, isDesktopRuntime } from "../shared/runtime.js";
import { useChatStore } from "./store/useChatStore.js";
import { useChatActions } from "./composables/useChatActions.js";
import { useGroupManagement } from "./composables/useGroupManagement.js";
import { usePasswordChange } from "./composables/usePasswordChange.js";
import { useChatRealtime } from "./composables/useChatRealtime.js";
import { useChatPageRuntime } from "./composables/useChatPageRuntime.js";
import { useStickerLibrary } from "./composables/useStickerLibrary.js";
import { formatChatTitle } from "./composables/chat-title-format.js";

const auth = getAuth();
const store = useChatStore(auth);
const actions = useChatActions(store);
const groupManagement = useGroupManagement(store, actions);
const passwordChange = usePasswordChange();
const stickerLibrary = useStickerLibrary();
const queryConversationId = new URLSearchParams(window.location.search).get("conversationId") || "";
const desktopConversationId = getDesktopConversationId() || queryConversationId;
const standaloneConversationMode = computed(() => (
  isDesktopRuntime() && getDesktopWindowKind() === "chat"
));
const desktopTitlebarTitle = computed(() => formatChatTitle(
  store.chatTitle.value || "消息",
  store.selectedConversation.value?.kind || "",
  store.selectedConversation.value?.participantIds?.length || store.participants.value.length,
));
let runtime = null;
const realtime = useChatRealtime(
  auth,
  store.selectedId,
  store.conversations,
  store.socketOnline,
  (event) => runtime?.handleRealtimeEvent?.(event),
);

async function selectConversation(id) {
  await actions.selectConversation(id);
  realtime.joinSelectedConversation();
}
runtime = useChatPageRuntime({
  auth,
  store,
  actions,
  realtime,
  stickerLibrary,
  desktopConversationId,
  standaloneConversationMode,
  selectConversation,
});
</script>

<template>
  <main class="desktop-page-shell chat-page-shell">
    <DesktopTitlebar
      v-if="!standaloneConversationMode"
      app-title="Linksee Chat"
      :view-title="desktopTitlebarTitle"
      :view-meta="standaloneConversationMode ? '独立聊天窗口' : (store.socketOnline.value ? '实时连接已建立' : '正在连接服务端')"
    />

    <ChatPageWorkspace
      :auth="auth"
      :store="store"
      :actions="actions"
      :runtime="runtime"
      :sticker-library="stickerLibrary"
      :group-management="groupManagement"
      :standalone-conversation-mode="standaloneConversationMode"
      :select-conversation="selectConversation"
      @logout="logout"
    />

    <ChatPageDialogs
      :auth="auth"
      :store="store"
      :actions="actions"
      :runtime="runtime"
      :sticker-library="stickerLibrary"
      :group-management="groupManagement"
      :password-change="passwordChange"
      :standalone-conversation-mode="standaloneConversationMode"
      @logout="logout"
    />
  </main>
</template>
