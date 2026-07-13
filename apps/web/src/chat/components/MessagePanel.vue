<script setup>
import { ref } from "vue";
import ChatComposer from "./ChatComposer.vue";
import MessageListViewport from "./MessageListViewport.vue";
import ChatWorkspaceHeader from "./ChatWorkspaceHeader.vue";
import MessageContextMenu from "./MessageContextMenu.vue";
import { useMessagePanelContextMenu } from "../composables/useMessagePanelContextMenu.js";
import { useMessagePanelDrag } from "../composables/useMessagePanelDrag.js";
import { useMessagePanelScroll } from "../composables/useMessagePanelScroll.js";
import { useMessagePanelSearch } from "../composables/useMessagePanelSearch.js";

const props = defineProps({
  chatTitle: { type: String, default: "请选择会话" },
  chatSubtitle: { type: String, default: "选择一个会话开始聊天" },
  chatKind: { type: String, default: "" },
  hasConversation: { type: Boolean, default: false },
  participantCount: { type: Number, default: 0 },
  messageKeyword: { type: String, default: "" },
  socketOnline: { type: Boolean, default: false },
  networkBannerText: { type: String, default: "" },
  searchResultText: { type: String, default: "" },
  searching: { type: Boolean, default: false },
  messages: { type: Array, default: () => [] },
  replyText: { type: String, default: "" },
  showReplyBar: { type: Boolean, default: false },
  messageInput: { type: String, default: "" },
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
  pendingFiles: { type: Array, default: () => [] },
  uploadingFiles: { type: Boolean, default: false },
  uploadProgressText: { type: String, default: "" },
  downloadProgressText: { type: String, default: "" },
  hasMoreMessages: { type: Boolean, default: false },
  loadingMoreMessages: { type: Boolean, default: false },
  loadState: { type: Object, default: () => ({ status: "idle", message: "" }) },
  standaloneMode: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
  recentStickers: { type: Array, default: () => [] },
  stickersLoading: { type: Boolean, default: false },
  stickersHint: { type: String, default: "" },
  stickersHintTone: { type: String, default: "" },
});

const emit = defineEmits([
  "update:messageKeyword",
  "search",
  "clear-search",
  "cancel-edit",
  "update:messageInput",
  "message-keydown",
  "mention-pick",
  "submit",
  "message-action",
  "open-file-picker",
  "capture-screenshot",
  "open-sticker-import",
  "send-sticker",
  "clear-recent-stickers",
  "download-file",
  "save-file-as",
  "open-file",
  "open-file-location",
  "copy-image",
  "open-image",
  "file-change",
  "file-paste",
  "file-drop",
  "remove-pending-file",
  "load-more",
  "retry-load",
]);

const messageListViewportRef = ref(null);
const workspaceRef = ref(null);
const { contextMenuItems, messageMenu, openMessageMenu, selectContextItem } = useMessagePanelContextMenu(emit);
const { dragActive, handleDragEnter, handleDragLeave, handleDragOver, handleDrop } = useMessagePanelDrag(workspaceRef, emit);
const { pendingIncomingCount, scrollMessageListToBottom } = useMessagePanelScroll(props, messageListViewportRef);
const { jumpSearchMatch, searchMatchIndex, searchMatches } = useMessagePanelSearch(props, messageListViewportRef);
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
    <ChatWorkspaceHeader
      :chat-title="chatTitle"
      :chat-kind="chatKind"
      :participant-count="participantCount"
      :standalone-mode="standaloneMode"
      :network-banner-text="networkBannerText"
      :message-keyword="messageKeyword"
      :searching="searching"
      :search-result-text="searchResultText"
      :search-match-index="searchMatchIndex"
      :search-matches-length="searchMatches.length"
      @update:message-keyword="$emit('update:messageKeyword', $event)"
      @search="$emit('search')"
      @clear-search="$emit('clear-search')"
      @search-prev="jumpSearchMatch(-1)"
      @search-next="jumpSearchMatch(1)"
    />

    <MessageListViewport
      ref="messageListViewportRef"
      :has-conversation="hasConversation"
      :has-more-messages="hasMoreMessages"
      :load-state="loadState"
      :loading-more-messages="loadingMoreMessages"
      :messages="messages"
      :pending-incoming-count="pendingIncomingCount"
      @download-file="$emit('download-file', $event)"
      @load-more="$emit('load-more')"
      @message-action="$emit('message-action', $event)"
      @open-file="$emit('open-file', $event)"
      @open-file-location="$emit('open-file-location', $event)"
      @open-image="$emit('open-image', $event)"
      @open-menu="openMessageMenu"
      @retry-load="$emit('retry-load')"
      @save-file-as="$emit('save-file-as', $event)"
      @scroll-to-bottom="scrollMessageListToBottom('smooth')"
    />

    <ChatComposer
      :show-reply-bar="showReplyBar"
      :reply-text="replyText"
      :message-input="messageInput"
      :mention-open="mentionOpen"
      :mention-options="mentionOptions"
      :composer-hint="composerHint"
      :composer-hint-tone="composerHintTone"
      :pending-files="pendingFiles"
      :uploading-files="uploadingFiles"
      :upload-progress-text="uploadProgressText"
      :download-progress-text="downloadProgressText"
      :recent-stickers="recentStickers"
      :stickers="stickers"
      :stickers-loading="stickersLoading"
      :stickers-hint="stickersHint"
      :stickers-hint-tone="stickersHintTone"
      @cancel-edit="$emit('cancel-edit')"
      @update:message-input="$emit('update:messageInput', $event)"
      @message-keydown="$emit('message-keydown', $event)"
      @mention-pick="$emit('mention-pick', $event)"
      @submit="$emit('submit')"
      @open-file-picker="$emit('open-file-picker')"
      @capture-screenshot="$emit('capture-screenshot')"
      @open-sticker-import="$emit('open-sticker-import')"
      @send-sticker="$emit('send-sticker', $event)"
      @clear-recent-stickers="$emit('clear-recent-stickers')"
      @file-change="$emit('file-change', $event)"
      @file-paste="$emit('file-paste', $event)"
      @remove-pending-file="$emit('remove-pending-file', $event)"
    />

    <MessageContextMenu
      :open="messageMenu.open"
      :x="messageMenu.x"
      :y="messageMenu.y"
      :items="contextMenuItems"
      @select="selectContextItem"
    />

    <div v-if="dragActive" class="chat-drop-overlay">
      <div class="chat-drop-card chat-drop-card-quiet">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M10 10h12l4 5h12a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Zm14 10-8 8h5v7h6v-7h5l-8-8Z"/>
        </svg>
      </div>
    </div>
  </section>
</template>
