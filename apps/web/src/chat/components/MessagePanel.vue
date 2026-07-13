<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useDesktopShell } from "../../shared/useDesktopShell.js";
import AttachmentPreview from "./AttachmentPreview.vue";
import EmojiPicker from "./EmojiPicker.vue";
import MessageBubble from "./MessageBubble.vue";
import MessageContextMenu from "./MessageContextMenu.vue";
import StickerPicker from "./StickerPicker.vue";

const shell = useDesktopShell();

const props = defineProps({
  chatTitle: { type: String, default: "请选择会话" },
  chatSubtitle: { type: String, default: "选择一个会话开始聊天" },
  chatKind: { type: String, default: "" },
  participantCount: { type: Number, default: 0 },
  messageKeyword: { type: String, default: "" },
  socketOnline: { type: Boolean, default: false },
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
  standaloneMode: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
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
  "open-sticker-import",
  "send-sticker",
  "download-file",
  "open-image",
  "file-change",
  "file-paste",
  "file-drop",
  "remove-pending-file",
  "load-more",
]);

const emojiOpen = ref(false);
const stickerOpen = ref(false);
const messageListRef = ref(null);
const workspaceRef = ref(null);
const composerInputRef = ref(null);
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
    message.files.forEach((file, index) => items.push({
      key: `download:${index}`,
      label: file.expired ? `${file.name} 已过期` : `下载 ${file.name}`,
      meta: file.expiryText,
      disabled: file.expired,
      file,
    }));
  }
  return items;
});

const displayChatTitle = computed(() => {
  if (props.chatKind !== "group") return props.chatTitle;
  const count = Number(props.participantCount || 0);
  return count > 0 ? `${props.chatTitle}（${count}）` : props.chatTitle;
});

function closeFloatingPanels() {
  emojiOpen.value = false;
  stickerOpen.value = false;
  messageMenu.value = {
    open: false,
    x: 0,
    y: 0,
    message: null,
  };
}

function handleGlobalPointer(event) {
  const target = event.target;
  if (target instanceof HTMLElement
    && (target.closest(".message-context-menu") || target.closest(".emoji-picker") || target.closest(".sticker-picker") || target.closest(".qq-chat-tool-btn.is-emoji") || target.closest(".qq-chat-tool-btn.is-sticker"))) {
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

function toggleEmojiPicker() {
  messageMenu.value.open = false;
  stickerOpen.value = false;
  emojiOpen.value = !emojiOpen.value;
  if (emojiOpen.value) {
    nextTick(() => composerInputRef.value?.focus());
  }
}

function toggleStickerPicker() {
  messageMenu.value.open = false;
  emojiOpen.value = false;
  stickerOpen.value = !stickerOpen.value;
}

function appendEmoji(emoji) {
  emit("update:messageInput", `${props.messageInput || ""}${emoji}`);
  emojiOpen.value = false;
  nextTick(() => composerInputRef.value?.focus());
}

function sendSticker(sticker) {
  emit("send-sticker", sticker);
  stickerOpen.value = false;
  nextTick(() => composerInputRef.value?.focus());
}

function openMessageMenu(payload) {
  const nextX = Math.min(payload.event.clientX, window.innerWidth - 220);
  const nextY = Math.min(payload.event.clientY, window.innerHeight - 260);
  emojiOpen.value = false;
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
    emit("download-file", item.file);
    closeFloatingPanels();
    return;
  }
  emit("message-action", {
    id: messageMenu.value.message?.id,
    action: item.key,
  });
  closeFloatingPanels();
}

function updateMessageInput(value) {
  emit("update:messageInput", value);
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
  if (!event.dataTransfer?.files?.length) return;
  event.preventDefault();
  resetDragState();
  emit("file-drop", event.dataTransfer.files);
}

function handleComposerPaste(event) {
  const files = Array.from(event.clipboardData?.files || []).filter((file) => String(file.type || "").startsWith("image/"));
  if (!files.length) return;
  event.preventDefault();
  emit("file-paste", files);
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
  () => props.showReplyBar,
  (nextValue, previousValue) => {
    if (!nextValue || nextValue === previousValue) return;
    nextTick(() => composerInputRef.value?.focus());
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
    <div v-if="standaloneMode" class="chat-standalone-topbar">
      <div class="chat-window-drag">
        <span class="chat-window-mark">L</span>
        <span class="chat-window-app">Linksee Chat</span>
      </div>
      <div v-if="shell.isDesktop" class="chat-window-actions">
        <button class="desktop-window-btn desktop-window-btn-standalone" type="button" aria-label="最小化" @click="shell.minimizeWindow">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.75h8v1.5H2z"/></svg>
        </button>
        <button class="desktop-window-btn desktop-window-btn-standalone" type="button" aria-label="最大化" @click="shell.toggleMaximizeWindow">
          <svg v-if="shell.isMaximized" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 1.5h6v6H7.5V9h-6V3h1.5V1.5Zm0 3h3v3H3v-3Zm1.5-1.5V3h4.5v4.5H9V3h-4.5Z"/>
          </svg>
          <svg v-else viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2 2h8v8H2V2Zm1.5 1.5v5h5v-5h-5Z"/>
          </svg>
        </button>
        <button class="desktop-window-btn desktop-window-btn-standalone is-close" type="button" aria-label="关闭" @click="shell.closeWindow">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3.06 2 2.94 2.94L8.94 2 10 3.06 7.06 6 10 8.94 8.94 10 6 7.06 3.06 10 2 8.94 4.94 6 2 3.06 3.06 2Z"/></svg>
        </button>
      </div>
    </div>

    <header class="chat-workspace-head" :class="{ 'is-standalone': standaloneMode }">
      <div class="chat-title-block">
        <h2>{{ displayChatTitle }}</h2>
      </div>
    </header>

    <div class="chat-toolbar-search">
      <div class="chat-toolbar-search-inner">
        <input
          :value="messageKeyword"
          class="qq-search qq-search-inline is-chat"
          placeholder="搜索消息"
          @input="$emit('update:messageKeyword', $event.target.value)"
          @keydown.enter.prevent="$emit('search')"
        />
        <button v-if="messageKeyword || searching" class="ghost-btn compact-btn" type="button" @click="$emit('clear-search')">
          清除
        </button>
      </div>
    </div>

    <div v-if="searchResultText" class="search-bar">{{ searchResultText }}</div>
    <div v-if="searching && searchMatches.length" class="search-bar search-nav-bar">
      <span>当前匹配 {{ searchMatchIndex + 1 }} / {{ searchMatches.length }}</span>
      <div class="search-nav-actions">
        <button class="ghost-btn compact-btn" type="button" @click="jumpSearchMatch(-1)">上一条</button>
        <button class="ghost-btn compact-btn" type="button" @click="jumpSearchMatch(1)">下一条</button>
      </div>
    </div>

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
      <div v-if="!messages.length" class="empty-state">这里还没有消息，发一条开始吧。</div>
      <MessageBubble
        v-for="message in messages"
        :key="message.id"
        :message="message"
        @download-file="$emit('download-file', $event)"
        @open-image="$emit('open-image', $event)"
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

    <div v-if="showReplyBar" class="reply-bar">{{ replyText }}</div>

    <form class="composer desktop-composer" @submit.prevent="$emit('submit')">
      <input class="hidden" type="file" multiple @change="$emit('file-change', $event)" />
      <div class="composer-top desktop-composer-top">
        <div class="composer-tool-group qq-composer-toolbar">
          <button v-if="showReplyBar" class="ghost-btn compact-btn" type="button" @click="$emit('cancel-edit')">取消回复</button>
          <button class="qq-chat-tool-btn is-emoji" type="button" title="表情" @click="toggleEmojiPicker">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm-3 7a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 9 9Zm6 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 15 9Zm-6.18 5.36a1 1 0 0 0-1.64 1.14A5.98 5.98 0 0 0 12 18a5.98 5.98 0 0 0 4.82-2.5a1 1 0 1 0-1.64-1.14A3.98 3.98 0 0 1 12 16a3.98 3.98 0 0 1-3.18-1.64Z"/></svg>
          </button>
          <button v-if="shell.isDesktop" class="qq-chat-tool-btn is-sticker" type="button" title="表情包" @click="toggleStickerPicker">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14a2 2 0 0 1 2 2v7.5A6.5 6.5 0 0 1 14.5 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm9.5 14A4.5 4.5 0 0 0 19 13.5V6H5v12h9.5ZM8 9.25a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Zm5 0a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Zm-5.2 5.52a1 1 0 0 0 .4 1.36c1.14.64 2.4.97 3.8.97c1.4 0 2.66-.33 3.8-.97a1 1 0 0 0-.96-1.76c-.83.46-1.75.69-2.84.69s-2.01-.23-2.84-.69a1 1 0 0 0-1.36.4Z"/></svg>
          </button>
          <button class="qq-chat-tool-btn" type="button" title="发送文件" :disabled="uploadingFiles" @click="$emit('open-file-picker')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 7H9.83l-2-2H5a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V9c0-1.1-.9-2-2-2Zm0 10H5V7h2l2 2h10v8Z"/></svg>
          </button>
        </div>
        <div v-if="uploadProgressText || downloadProgressText" class="search-bar upload-inline-tip">
          {{ uploadProgressText || downloadProgressText }}
        </div>
      </div>

      <EmojiPicker :open="emojiOpen" @pick="appendEmoji" />
      <StickerPicker
        :open="stickerOpen"
        :stickers="stickers"
        :loading="stickersLoading"
        :hint="stickersHint"
        :hint-tone="stickersHintTone"
        :desktop-mode="shell.isDesktop"
        @pick="sendSticker"
        @import-files="$emit('open-sticker-import')"
      />

      <AttachmentPreview
        :files="pendingFiles"
        @remove="$emit('remove-pending-file', $event)"
      />

      <textarea
        ref="composerInputRef"
        :value="messageInput"
        class="message-input desktop-message-input"
        rows="4"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行，@ 可提及成员"
        @input="updateMessageInput($event.target.value)"
        @keydown="$emit('message-keydown', $event)"
        @paste="handleComposerPaste"
      ></textarea>

      <div v-if="mentionOpen && mentionOptions.length" class="mention-panel">
        <div
          v-for="(user, index) in mentionOptions"
          :key="user.id"
          class="mention-item"
          :class="{ active: index === 0 }"
          @click="$emit('mention-pick', user.id)"
        >
          @{{ user.profile.realName || user.id }}
        </div>
      </div>

      <div class="composer-row">
        <div class="hint" :class="composerHint ? (composerHintTone === 'error' ? 'is-error' : 'is-success') : ''">
          {{ composerHint }}
        </div>
        <div class="composer-send-group">
          <button class="ghost-btn composer-quiet-btn" type="button" @click="updateMessageInput('')">清空</button>
          <button class="primary-btn composer-send-btn" type="submit">发送</button>
        </div>
      </div>
    </form>

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
