<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ChatComposer from "./ChatComposer.vue";
import ChatWorkspaceHeader from "./ChatWorkspaceHeader.vue";
import MessageBubble from "./MessageBubble.vue";
import MessageContextMenu from "./MessageContextMenu.vue";
import StatePanel from "./StatePanel.vue";

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

const messageListRef = ref(null);
const workspaceRef = ref(null);
const pendingIncomingCount = ref(0);
const dragActive = ref(false);
const searchMatchIndex = ref(-1);
const searchMatches = ref([]);
const messageMenu = ref({
  open: false,
  x: 0,
  y: 0,
  message: null,
});

const contextMenuItems = computed(() => {
  const message = messageMenu.value.message;
  if (!message) return [];
  const items = [{ key: "reply", label: "回复" }];
  if (message.canForward) items.push({ key: "forward", label: "转发" });
  items.push({ key: "favorite", label: message.isFavorite ? "取消收藏" : "收藏" });
  if (message.canRecall) items.push({ key: "recall", label: "撤回", tone: "danger" });
  if (message.canDelete) items.push({ key: "delete", label: "删除", tone: "danger" });
  if (message.canRetry) items.push({ key: "retry", label: "重试发送" });
  if (message.isFileMessage) {
    message.files
      .filter((file) => file.transfer?.status === "saved" && file.transfer?.path)
      .forEach((file, index) => items.push({
        key: `open-file:${index}`,
        label: `打开 ${file.name}`,
        meta: file.transfer?.path || "",
        disabled: !file.transfer?.path,
        file,
        action: "open-file",
      }));
    message.files.forEach((file, index) => items.push({
      key: `save-as:${index}`,
      label: file.expired ? `${file.name} 已过期` : `另存为 ${file.name}`,
      meta: file.expiryText,
      disabled: file.expired,
      file,
      action: "save-as",
    }));
    message.files
      .filter((file) => file.isImage && !file.expired && file.objectKey)
      .forEach((file, index) => items.push({
        key: `copy-image:${index}`,
        label: `复制 ${file.name}`,
        meta: file.metaText,
        disabled: false,
        file,
        action: "copy-image",
      }));
    message.files
      .filter((file) => file.transfer?.status === "saved" && file.transfer?.path)
      .forEach((file, index) => items.push({
        key: `open-location:${index}`,
        label: `打开 ${file.name} 所在位置`,
        meta: file.transfer?.path || "",
        disabled: !file.transfer?.path,
        file,
        action: "open-location",
      }));
  }
  return items;
});

function closeFloatingPanels() {
  messageMenu.value = {
    open: false,
    x: 0,
    y: 0,
    message: null,
  };
}

function handleGlobalPointer(event) {
  const target = event.target;
  if (target instanceof HTMLElement && target.closest(".message-context-menu")) {
    return;
  }
  closeFloatingPanels();
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape") closeFloatingPanels();
}

window.addEventListener("pointerdown", handleGlobalPointer);
window.addEventListener("keydown", handleGlobalKeydown);

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleGlobalPointer);
  window.removeEventListener("keydown", handleGlobalKeydown);
});

function openMessageMenu(payload) {
  const nextX = Math.min(payload.event.clientX, window.innerWidth - 220);
  const nextY = Math.min(payload.event.clientY, window.innerHeight - 260);
  messageMenu.value = {
    open: true,
    x: Math.max(12, nextX),
    y: Math.max(12, nextY),
    message: payload.message,
  };
}

function selectContextItem(item) {
  if (item.disabled) return;
  if (item.file) {
    if (item.action === "copy-image") {
      emit("copy-image", item.file);
      closeFloatingPanels();
      return;
    }
    if (item.action === "open-file") {
      emit("open-file", item.file);
      closeFloatingPanels();
      return;
    }
    if (item.action === "open-location") {
      emit("open-file-location", item.file);
      closeFloatingPanels();
      return;
    }
    emit("save-file-as", item.file);
    closeFloatingPanels();
    return;
  }
  emit("message-action", {
    id: messageMenu.value.message?.id,
    action: item.key,
  });
  closeFloatingPanels();
}

function collectSearchMatches() {
  const element = messageListRef.value;
  if (!element) {
    searchMatches.value = [];
    searchMatchIndex.value = -1;
    return;
  }
  searchMatches.value = Array.from(element.querySelectorAll(".message-search-mark"));
  if (!searchMatches.value.length) {
    searchMatchIndex.value = -1;
    return;
  }
  if (searchMatchIndex.value < 0 || searchMatchIndex.value >= searchMatches.value.length) searchMatchIndex.value = 0;
  searchMatches.value.forEach((node, index) => node.classList.toggle("is-active", index === searchMatchIndex.value));
}

function focusSearchMatch(index) {
  if (!searchMatches.value.length) return;
  const safeIndex = ((index % searchMatches.value.length) + searchMatches.value.length) % searchMatches.value.length;
  searchMatchIndex.value = safeIndex;
  searchMatches.value.forEach((node, nextIndex) => node.classList.toggle("is-active", nextIndex === safeIndex));
  searchMatches.value[safeIndex]?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function jumpSearchMatch(step) {
  if (!searchMatches.value.length) return;
  focusSearchMatch(searchMatchIndex.value + step);
}

function getDistanceFromBottom() {
  const element = messageListRef.value;
  if (!element) return 0;
  return Math.max(0, element.scrollHeight - element.scrollTop - element.clientHeight);
}

function isNearBottom() {
  return getDistanceFromBottom() <= 56;
}

function clearIncomingIndicator() {
  pendingIncomingCount.value = 0;
}

function scrollMessageListToBottom(behavior = "auto") {
  const element = messageListRef.value;
  if (!element) return;
  element.scrollTo({
    top: element.scrollHeight,
    behavior,
  });
  clearIncomingIndicator();
}

function handleMessageListScroll() {
  if (isNearBottom()) clearIncomingIndicator();
}

function isFileDrag(event) {
  return event.dataTransfer?.types?.includes("Files");
}

function isPointInsideWorkspace(clientX, clientY) {
  const element = workspaceRef.value;
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function resetDragState() {
  dragActive.value = false;
}

function handleDragEnter(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  dragActive.value = isPointInsideWorkspace(event.clientX, event.clientY);
}

function handleDragOver(event) {
  if (!isFileDrag(event)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
  dragActive.value = isPointInsideWorkspace(event.clientX, event.clientY);
}

function handleDragLeave(event) {
  if (!isFileDrag(event)) return;
  if (isPointInsideWorkspace(event.clientX, event.clientY)) return;
  resetDragState();
}

function handleDrop(event) {
  if (!event.dataTransfer?.files?.length && !event.dataTransfer?.items?.length) return;
  event.preventDefault();
  resetDragState();
  const items = Array.from(event.dataTransfer?.items || []);
  const directoryLike = items.filter((item) => {
    if (item.kind !== "file") return false;
    return typeof item.webkitGetAsEntry === "function" && item.webkitGetAsEntry()?.isDirectory;
  }).length;
  emit("file-drop", {
    files: event.dataTransfer.files,
    directoryLike,
  });
}

function handleWindowDragOver(event) {
  if (!dragActive.value || !isFileDrag(event)) return;
  if (!isPointInsideWorkspace(event.clientX, event.clientY)) resetDragState();
}

function handleWindowDragEnd() {
  resetDragState();
}

onMounted(() => {
  window.addEventListener("dragover", handleWindowDragOver);
  window.addEventListener("drop", handleWindowDragEnd);
  window.addEventListener("dragend", handleWindowDragEnd);
  window.addEventListener("blur", handleWindowDragEnd);
  nextTick(() => {
    scrollMessageListToBottom("auto");
    messageListRef.value?.addEventListener("scroll", handleMessageListScroll, { passive: true });
  });
});
watch(
  () => props.chatTitle,
  async () => {
    clearIncomingIndicator();
    await nextTick();
    scrollMessageListToBottom("auto");
  },
);
watch(
  () => props.messages[props.messages.length - 1]?.id || "",
  async (nextId, previousId) => {
    if (!nextId || nextId === previousId) return;
    const shouldAutoStick = isNearBottom();
    const latestMessage = props.messages[props.messages.length - 1];
    await nextTick();
    if (!previousId || latestMessage?.isMe || shouldAutoStick) {
      scrollMessageListToBottom(previousId ? "smooth" : "auto");
      return;
    }
    pendingIncomingCount.value += 1;
  },
);
watch(
  () => [props.searching, props.searchResultText, props.messages.length],
  async () => {
    await nextTick();
    collectSearchMatches();
  },
  { deep: true },
);
onBeforeUnmount(() => {
  window.removeEventListener("dragover", handleWindowDragOver);
  window.removeEventListener("drop", handleWindowDragEnd);
  window.removeEventListener("dragend", handleWindowDragEnd);
  window.removeEventListener("blur", handleWindowDragEnd);
  messageListRef.value?.removeEventListener("scroll", handleMessageListScroll);
});
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

    <div ref="messageListRef" class="message-list desktop-message-list">
      <button
        v-if="hasMoreMessages"
        class="ghost-btn load-more-btn compact-btn"
        type="button"
        :disabled="loadingMoreMessages"
        @click="$emit('load-more')"
      >
        {{ loadingMoreMessages ? "加载中..." : "查看更多消息" }}
      </button>
      <StatePanel
        v-if="!hasConversation"
        title="暂无会话"
        message="选择一个联系人开始聊天"
      />
      <StatePanel
        v-else-if="!messages.length && loadState?.status === 'error'"
        title="加载失败，请重试"
        :message="loadState?.message || '暂时无法获取聊天内容'"
        action-text="重新加载"
        @action="$emit('retry-load')"
      />
      <div v-else-if="!messages.length" class="empty-state">这里还没有消息，发一条开始吧。</div>
      <MessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
        @download-file="$emit('download-file', $event)"
        @save-file-as="$emit('save-file-as', $event)"
        @open-image="$emit('open-image', $event)"
        @open-file="$emit('open-file', $event)"
        @open-file-location="$emit('open-file-location', $event)"
        @open-menu="openMessageMenu"
        @retry="$emit('message-action', { id: $event, action: 'retry' })"
      />
      <button
        v-if="pendingIncomingCount"
        class="new-message-indicator"
        type="button"
        @click="scrollMessageListToBottom('smooth')"
      >
        <span class="new-message-indicator__count">{{ pendingIncomingCount }}</span>
        <span>新消息</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 14.25 4.75 9l1.5-1.5 2.75 2.75V4.5h2v5.75L13.75 7.5l1.5 1.5L10 14.25Z"/>
        </svg>
      </button>
    </div>

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
