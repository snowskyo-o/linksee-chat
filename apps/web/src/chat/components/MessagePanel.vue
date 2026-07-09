<script setup>
defineProps({
  chatTitle: { type: String, default: "请选择会话" },
  chatSubtitle: { type: String, default: "登录后可查看你已加入的会话。" },
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
  <section class="qq-main">
    <header class="chat-panel-head">
      <div>
        <h2>{{ chatTitle }}</h2>
        <p class="muted">{{ chatSubtitle }}</p>
      </div>
      <div class="head-actions">
        <input
          :value="messageKeyword"
          class="qq-search qq-search-inline"
          placeholder="搜索消息"
          @input="$emit('update:messageKeyword', $event.target.value)"
          @keydown.enter.prevent="$emit('search')"
        />
        <button class="ghost-btn" type="button" @click="$emit('announcement')">公告</button>
        <button class="ghost-btn" type="button" @click="$emit('toggle-pin')">{{ isPinned ? "取消置顶" : "置顶会话" }}</button>
        <div class="socket-pill" :class="socketOnline ? 'online' : 'offline'">
          {{ socketOnline ? "在线" : "离线" }}
        </div>
      </div>
    </header>

    <div v-if="searchResultText" class="search-bar">{{ searchResultText }}</div>

    <div class="message-list">
      <button
        v-if="hasMoreMessages"
        class="ghost-btn load-more-btn"
        type="button"
        :disabled="loadingMoreMessages"
        @click="$emit('load-more')"
      >
        {{ loadingMoreMessages ? "加载中..." : "加载更早消息" }}
      </button>
      <div v-if="!messages.length" class="empty-state">这里还没有消息，发一条开始吧。</div>
      <article
        v-for="message in messages"
        :key="message.id"
        class="message-item"
        :class="{ me: message.isMe, deleted: message.deletedAt }"
      >
        <div class="message-avatar" v-if="!message.isMe">
          <img v-if="message.avatarUrl" :src="message.avatarUrl" alt="" />
          <span v-else>{{ message.senderName.slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="message-body">
          <div class="message-head">
            <strong>{{ message.senderName }}</strong>
            <span>
              <span v-if="message.type === 'announcement'" class="badge ghost">公告</span>
              <span class="muted">{{ message.timeText }}{{ message.editedAt ? " · 已编辑" : "" }}</span>
            </span>
          </div>
          <div v-if="message.replyToText" class="reply-quote">{{ message.replyToText }}</div>
          <div class="message-content" v-html="message.html"></div>
          <div class="message-actions">
            <button class="message-link" type="button" @click="$emit('message-action', { id: message.id, action: 'reply' })">回复</button>
            <button
              v-if="message.canEdit"
              class="message-link"
              type="button"
              @click="$emit('message-action', { id: message.id, action: 'edit' })"
            >
              编辑
            </button>
            <button
              v-if="message.canRecall"
              class="message-link"
              type="button"
              @click="$emit('message-action', { id: message.id, action: 'recall' })"
            >
              撤回
            </button>
            <template v-if="message.isFileMessage">
              <button
                v-for="file in message.files"
                :key="file.objectKey"
                class="message-link"
                type="button"
                :disabled="file.expired || !file.downloadPath"
                @click="$emit('download-file', file)"
              >
                {{ file.expired ? `${file.name} 已过期` : `下载 ${file.name}` }}
              </button>
            </template>
          </div>
          <div v-if="message.isFileMessage" class="file-list">
            <div v-for="file in message.files" :key="file.objectKey" class="file-card" :class="{ expired: file.expired }">
              <div class="file-card-main">
                <strong>{{ file.name }}</strong>
                <span class="muted">{{ file.metaText }}</span>
              </div>
              <span class="file-expiry" :class="{ expired: file.expired }">{{ file.expiryText }}</span>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div v-if="showReplyBar" class="reply-bar">{{ replyText }}</div>

    <form class="composer" @submit.prevent="$emit('submit')">
      <input class="hidden" type="file" multiple @change="$emit('file-change', $event)" />
      <div class="composer-top">
        <button v-if="editing || showReplyBar" class="ghost-btn" type="button" @click="$emit('cancel-edit')">取消编辑</button>
        <button class="ghost-btn" type="button" @click="$emit('mark-read')">标记已读</button>
        <button class="ghost-btn" type="button" :disabled="uploadingFiles" @click="$emit('open-file-picker')">
          {{ uploadingFiles ? "上传中..." : "发送文件" }}
        </button>
      </div>
      <div v-if="uploadProgressText" class="search-bar">{{ uploadProgressText }}</div>
      <textarea
        :value="messageInput"
        class="message-input"
        rows="4"
        placeholder="输入消息，输入 @ 可提及成员，Enter 发送，Shift+Enter 换行"
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
        <div class="composer-actions">
          <button class="primary-btn" type="submit">发送</button>
        </div>
      </div>
    </form>
  </section>
</template>
