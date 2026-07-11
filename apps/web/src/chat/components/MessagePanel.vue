<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useDesktopShell } from "../../shared/useDesktopShell.js";
import EmojiPicker from "./EmojiPicker.vue";
import MessageBubble from "./MessageBubble.vue";
import MessageContextMenu from "./MessageContextMenu.vue";

const shell = useDesktopShell();

const props = defineProps({
  chatTitle: { type: String, default: "请选择会话" },
  chatSubtitle: { type: String, default: "选择一个会话开始聊天" },
  messageKeyword: { type: String, default: "" },
  socketOnline: { type: Boolean, default: false },
  searchResultText: { type: String, default: "" },
  messages: { type: Array, default: () => [] },
  replyText: { type: String, default: "" },
  showReplyBar: { type: Boolean, default: false },
  editing: { type: Boolean, default: false },
  messageInput: { type: String, default: "" },
  mentionOpen: { type: Boolean, default: false },
  mentionOptions: { type: Array, default: () => [] },
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
  uploadingFiles: { type: Boolean, default: false },
  uploadProgressText: { type: String, default: "" },
  isPinned: { type: Boolean, default: false },
  hasMoreMessages: { type: Boolean, default: false },
  loadingMoreMessages: { type: Boolean, default: false },
  standaloneMode: { type: Boolean, default: false },
});

const emit = defineEmits([
  "update:messageKeyword",
  "search",
  "announcement",
  "mark-read",
  "toggle-pin",
  "cancel-edit",
  "update:messageInput",
  "message-keydown",
  "mention-pick",
  "submit",
  "message-action",
  "open-file-picker",
  "download-file",
  "file-change",
  "load-more",
]);

const emojiOpen = ref(false);
const messageMenu = ref({
  open: false,
  x: 0,
  y: 0,
  message: null,
});

const contextMenuItems = computed(() => {
  const message = messageMenu.value.message;
  if (!message) return [];

  const items = [
    { key: "reply", label: "回复" },
  ];

  if (message.canEdit) {
    items.push({ key: "edit", label: "编辑" });
  }

  if (message.canRecall) {
    items.push({ key: "recall", label: "撤回", tone: "danger" });
  }

  if (message.isFileMessage) {
    message.files.forEach((file, index) => {
      items.push({
        key: `download:${index}`,
        label: file.expired ? `${file.name} 已过期` : `下载 ${file.name}`,
        meta: file.expiryText,
        disabled: file.expired,
        file,
      });
    });
  }

  return items;
});

function closeFloatingPanels() {
  emojiOpen.value = false;
  messageMenu.value = {
    open: false,
    x: 0,
    y: 0,
    message: null,
  };
}

function handleGlobalPointer(event) {
  const target = event.target;
  if (
    target instanceof HTMLElement
    && (target.closest(".message-context-menu") || target.closest(".emoji-picker") || target.closest(".qq-chat-tool-btn.is-emoji"))
  ) {
    return;
  }
  closeFloatingPanels();
}

function handleGlobalKeydown(event) {
  if (event.key === "Escape") {
    closeFloatingPanels();
  }
}

window.addEventListener("pointerdown", handleGlobalPointer);
window.addEventListener("keydown", handleGlobalKeydown);

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleGlobalPointer);
  window.removeEventListener("keydown", handleGlobalKeydown);
});

function toggleEmojiPicker() {
  messageMenu.value.open = false;
  emojiOpen.value = !emojiOpen.value;
}

function appendEmoji(emoji) {
  emit("update:messageInput", `${props.messageInput || ""}${emoji}`);
  emojiOpen.value = false;
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
</script>

<template>
  <section class="chat-workspace" :class="{ 'is-standalone': standaloneMode }">
    <div v-if="standaloneMode" class="chat-standalone-topbar">
      <div class="chat-window-drag">
        <span class="chat-window-mark">L</span>
        <span class="chat-window-app">Linksee Chat</span>
      </div>
      <div v-if="shell.isDesktop" class="chat-window-actions">
        <button class="desktop-window-btn desktop-window-btn-standalone" type="button" aria-label="最小化" @click="shell.minimizeWindow">─</button>
        <button class="desktop-window-btn desktop-window-btn-standalone" type="button" aria-label="最大化" @click="shell.toggleMaximizeWindow">
          {{ shell.isMaximized ? "❐" : "□" }}
        </button>
        <button class="desktop-window-btn desktop-window-btn-standalone is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
      </div>
    </div>

    <header class="chat-workspace-head" :class="{ 'is-standalone': standaloneMode }">
      <div class="chat-title-block">
        <h2>{{ chatTitle }}</h2>
        <p class="muted">{{ chatSubtitle }}</p>
      </div>
      <div class="head-actions qq-chat-head-actions">
        <button class="qq-chat-icon-btn" type="button" title="搜索消息" @click="$emit('search')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 4a6.5 6.5 0 1 1 0 13a6.5 6.5 0 0 1 0-13Zm0 2a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9Zm8.91 11.5 2.8 2.79-1.42 1.42-2.79-2.8 1.41-1.41Z"/></svg>
        </button>
        <button class="qq-chat-icon-btn" type="button" title="公告" @click="$emit('announcement')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5v3c0 .83.67 1.5 1.5 1.5H6l2 4h2l-1.5-4H12l6 3V6l-6 3H4.5c-.83 0-1.5.67-1.5 1.5Zm9-.28 4-2v7.56l-4-2V10.22Z"/></svg>
        </button>
        <button class="qq-chat-icon-btn" type="button" title="置顶会话" @click="$emit('toggle-pin')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3 9 8l2 2-4 6v2h10v-2l-4-6 2-2 4 4V5l-5-2Z"/></svg>
        </button>
        <button class="qq-chat-icon-btn" type="button" title="标记已读" @click="$emit('mark-read')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.55 17.7-4.9-4.9 1.4-1.4 3.5 3.49 8.4-8.39 1.4 1.41-9.8 9.79Zm0-5.66-1.41-1.4 1.41-1.42 1.41 1.42-1.41 1.4Z"/></svg>
        </button>
        <div class="socket-pill" :class="socketOnline ? 'online' : 'offline'">
          {{ socketOnline ? "在线" : "离线" }}
        </div>
      </div>
    </header>

    <div class="chat-toolbar-search">
      <input
        :value="messageKeyword"
        class="qq-search qq-search-inline is-chat"
        placeholder="搜索消息"
        @input="$emit('update:messageKeyword', $event.target.value)"
        @keydown.enter.prevent="$emit('search')"
      />
    </div>

    <div v-if="searchResultText" class="search-bar">{{ searchResultText }}</div>

    <div class="message-list desktop-message-list">
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
        @open-menu="openMessageMenu"
      />
    </div>

    <div v-if="showReplyBar" class="reply-bar">{{ replyText }}</div>

    <form class="composer desktop-composer" @submit.prevent="$emit('submit')">
      <input class="hidden" type="file" multiple @change="$emit('file-change', $event)" />
      <div class="composer-top desktop-composer-top">
        <div class="composer-tool-group qq-composer-toolbar">
          <button v-if="editing || showReplyBar" class="ghost-btn compact-btn" type="button" @click="$emit('cancel-edit')">取消</button>
          <button class="qq-chat-tool-btn is-emoji" type="button" title="表情" @click="toggleEmojiPicker">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20Zm-3 7a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 9 9Zm6 0a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 15 9Zm-6.18 5.36a1 1 0 0 0-1.64 1.14A5.98 5.98 0 0 0 12 18a5.98 5.98 0 0 0 4.82-2.5a1 1 0 1 0-1.64-1.14A3.98 3.98 0 0 1 12 16a3.98 3.98 0 0 1-3.18-1.64Z"/></svg>
          </button>
          <button class="qq-chat-tool-btn" type="button" title="发送文件" :disabled="uploadingFiles" @click="$emit('open-file-picker')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 7H9.83l-2-2H5a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2V9c0-1.1-.9-2-2-2Zm0 10H5V7h2l2 2h10v8Z"/></svg>
          </button>
        </div>
        <div v-if="uploadProgressText" class="search-bar upload-inline-tip">{{ uploadProgressText }}</div>
      </div>

      <EmojiPicker :open="emojiOpen" @pick="appendEmoji" />

      <textarea
        :value="messageInput"
        class="message-input desktop-message-input"
        rows="4"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行，@ 可提及成员"
        @input="updateMessageInput($event.target.value)"
        @keydown="$emit('message-keydown', $event)"
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
  </section>
</template>
