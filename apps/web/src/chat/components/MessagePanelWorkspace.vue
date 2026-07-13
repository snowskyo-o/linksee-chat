<script setup>
import ChatWorkspaceHeader from "./ChatWorkspaceHeader.vue";
import MessageListViewport from "./MessageListViewport.vue";
import MessagePanelComposer from "./MessagePanelComposer.vue";
import { messagePanelProps } from "./message-panel-contract.js";

defineProps({
  ...messagePanelProps,
  messageListViewportRef: { type: Object, default: null },
  pendingIncomingCount: { type: Number, default: 0 },
  searchMatchIndex: { type: Number, default: 0 },
  searchMatchesLength: { type: Number, default: 0 },
});

defineEmits([
  "cancel-edit", "capture-screenshot", "clear-recent-stickers", "clear-search", "download-file", "file-change",
  "file-paste", "load-more", "mention-pick", "message-action", "message-keydown", "open-file", "open-file-location",
  "open-image", "open-menu", "open-file-picker", "open-sticker-import", "remove-pending-file", "retry-load",
  "save-file-as", "scroll-to-bottom", "search", "search-next", "search-prev", "send-sticker", "submit",
  "update:messageInput", "update:messageKeyword",
]);
</script>

<template>
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
    :search-matches-length="searchMatchesLength"
    @update:message-keyword="$emit('update:messageKeyword', $event)"
    @search="$emit('search')"
    @clear-search="$emit('clear-search')"
    @search-prev="$emit('search-prev')"
    @search-next="$emit('search-next')"
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
    @open-menu="$emit('open-menu', $event)"
    @retry-load="$emit('retry-load')"
    @save-file-as="$emit('save-file-as', $event)"
    @scroll-to-bottom="$emit('scroll-to-bottom')"
  />

  <MessagePanelComposer
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
</template>
