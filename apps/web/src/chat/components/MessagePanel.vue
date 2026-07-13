<script setup>
import { computed, ref } from "vue";
import MessagePanelOverlay from "./MessagePanelOverlay.vue";
import MessagePanelWorkspace from "./MessagePanelWorkspace.vue";
import { useMessagePanelContextMenu } from "../composables/useMessagePanelContextMenu.js";
import { useMessagePanelDrag } from "../composables/useMessagePanelDrag.js";
import { useMessagePanelScroll } from "../composables/useMessagePanelScroll.js";
import { useMessagePanelSearch } from "../composables/useMessagePanelSearch.js";
import { messagePanelEmits, messagePanelProps } from "./message-panel-contract.js";

const props = defineProps(messagePanelProps);
const emit = defineEmits(messagePanelEmits);

const messageListViewportRef = ref(null);
const workspaceRef = ref(null);
const { contextMenuItems, messageMenu, openMessageMenu, selectContextItem } = useMessagePanelContextMenu(emit);
const { dragActive, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useMessagePanelDrag(workspaceRef, emit);
const { pendingIncomingCount, scrollMessageListToBottom } = useMessagePanelScroll(props, messageListViewportRef);
const { jumpSearchMatch, searchMatchIndex, searchMatches } = useMessagePanelSearch(props, messageListViewportRef);

const workspaceProps = computed(() => ({
  ...props,
  messageListViewportRef,
  pendingIncomingCount: pendingIncomingCount.value,
  searchMatchIndex: searchMatchIndex.value,
  searchMatchesLength: searchMatches.value.length,
}));

const workspaceListeners = {
  "cancel-edit": () => emit("cancel-edit"),
  "capture-screenshot": () => emit("capture-screenshot"),
  "clear-recent-stickers": () => emit("clear-recent-stickers"),
  "clear-search": () => emit("clear-search"),
  "copy-image": (file) => emit("copy-image", file),
  "download-file": (file) => emit("download-file", file),
  "file-change": (event) => emit("file-change", event),
  "file-paste": (event) => emit("file-paste", event),
  "load-more": () => emit("load-more"),
  "mention-pick": (user) => emit("mention-pick", user),
  "message-action": (payload) => emit("message-action", payload),
  "message-keydown": (event) => emit("message-keydown", event),
  "open-file": (file) => emit("open-file", file),
  "open-file-location": (file) => emit("open-file-location", file),
  "open-image": (file) => emit("open-image", file),
  "open-menu": openMessageMenu,
  "open-file-picker": () => emit("open-file-picker"),
  "open-sticker-import": () => emit("open-sticker-import"),
  "remove-pending-file": (file) => emit("remove-pending-file", file),
  "retry-pending-file": (file) => emit("retry-pending-file", file),
  "retry-load": () => emit("retry-load"),
  "save-file-as": (file) => emit("save-file-as", file),
  "scroll-to-bottom": () => scrollMessageListToBottom("smooth"),
  search: () => emit("search"),
  "search-next": () => jumpSearchMatch(1),
  "search-prev": () => jumpSearchMatch(-1),
  "send-sticker": (sticker) => emit("send-sticker", sticker),
  submit: () => emit("submit"),
  "update:messageInput": (value) => emit("update:messageInput", value),
  "update:messageKeyword": (value) => emit("update:messageKeyword", value),
};
</script>

<template>
  <section
    ref="workspaceRef"
    class="chat-workspace"
    :class="{ 'is-standalone': standaloneMode, 'is-drag-active': dragActive }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <MessagePanelWorkspace v-bind="workspaceProps" v-on="workspaceListeners" />

    <MessagePanelOverlay
      :context-menu-items="contextMenuItems"
      :drag-active="dragActive"
      :message-menu="messageMenu"
      @select-context="selectContextItem"
    />
  </section>
</template>
