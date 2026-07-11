<script setup>
import MessageBubble from "./MessageBubble.vue";

defineProps({
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
});

defineEmits([
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
</script>

<template>
  <section class="chat-workspace">
    <header class="chat-workspace-head">
      <div class="chat-title-block">
        <h2>{{ chatTitle }}</h2>
        <p class="muted">{{ chatSubtitle }}</p>
      </div>
      <div class="head-actions qq-chat-head-actions">
        <input
          :value="messageKeyword"
          class="qq-search qq-search-inline"
          placeholder="搜索消息"
          @input="$emit('update:messageKeyword', $event.target.value)"
          @keydown.enter.prevent="$emit('search')"
        />
        <button class="qq-chat-icon-btn" type="button" title="公告" @click="$emit('announcement')">公</button>
        <button class="qq-chat-icon-btn" type="button" title="置顶" @click="$emit('toggle-pin')">
          {{ isPinned ? "取" : "顶" }}
        </button>
        <div class="socket-pill" :class="socketOnline ? 'online' : 'offline'">
          {{ socketOnline ? "在线" : "离线" }}
        </div>
      </div>
    </header>

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
        @action="$emit('message-action', $event)"
        @download-file="$emit('download-file', $event)"
      />
    </div>

    <div v-if="showReplyBar" class="reply-bar">{{ replyText }}</div>

    <form class="composer desktop-composer" @submit.prevent="$emit('submit')">
      <input class="hidden" type="file" multiple @change="$emit('file-change', $event)" />
      <div class="composer-top desktop-composer-top">
        <div class="composer-tool-group qq-composer-toolbar">
          <button v-if="editing || showReplyBar" class="ghost-btn compact-btn" type="button" @click="$emit('cancel-edit')">取消</button>
          <button class="qq-chat-tool-btn" type="button" title="标记已读" @click="$emit('mark-read')">已</button>
          <button class="qq-chat-tool-btn" type="button" title="发送文件" :disabled="uploadingFiles" @click="$emit('open-file-picker')">
            {{ uploadingFiles ? "传" : "文" }}
          </button>
        </div>
        <div v-if="uploadProgressText" class="search-bar upload-inline-tip">{{ uploadProgressText }}</div>
      </div>
      <textarea
        :value="messageInput"
        class="message-input desktop-message-input"
        rows="4"
        placeholder="输入消息，Enter 发送，Shift+Enter 换行，@ 可提及成员"
        @input="$emit('update:messageInput', $event.target.value)"
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
        <button class="primary-btn" type="submit">发送</button>
      </div>
    </form>
  </section>
</template>
