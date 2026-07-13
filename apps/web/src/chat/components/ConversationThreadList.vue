<script setup>
import { onBeforeUnmount, ref } from "vue";
import AvatarImage from "../../shared/components/AvatarImage.vue";
import ConversationContextMenu from "./ConversationContextMenu.vue";

defineProps({
  rows: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
  formatTime: { type: Function, required: true },
  desktop: { type: Boolean, default: false },
});

const emit = defineEmits(["select", "open", "toggle-pin", "mark-read", "toggle-mute", "hide-conversation", "copy-title"]);

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const menuRow = ref(null);

function closeMenu() {
  menuOpen.value = false;
  menuRow.value = null;
}

function openMenu(event, row) {
  menuOpen.value = true;
  menuRow.value = row;
  menuX.value = event.clientX;
  menuY.value = event.clientY;
}

function handleCopyTitle() {
  if (!menuRow.value) return;
  emit("copy-title", menuRow.value);
  closeMenu();
}

function handleTogglePin(row) {
  emit("toggle-pin", row);
  closeMenu();
}

function handleToggleMute(row) {
  emit("toggle-mute", row);
  closeMenu();
}

function handleMarkRead() {
  if (!menuRow.value) return;
  emit("mark-read", menuRow.value);
  closeMenu();
}

function handleHideConversation() {
  if (!menuRow.value) return;
  emit("hide-conversation", menuRow.value);
  closeMenu();
}

onBeforeUnmount(() => {
  closeMenu();
});
</script>

<template>
  <div class="qq-thread-list" @mouseleave="closeMenu">
    <div v-if="!rows.length" class="empty-state">暂无会话</div>
    <article
      v-for="row in rows"
      :key="row.id"
      class="qq-thread-item"
      :class="{ 'is-active': row.id === selectedId }"
      @click="$emit('select', row.id)"
      @dblclick="$emit('open', row.id)"
      @contextmenu.prevent="openMenu($event, row)"
    >
      <div class="qq-thread-avatar">
        <AvatarImage :src="row.avatarUrl" alt="">
          <span>{{ (row.displayTitle || '?').slice(0, 2).toUpperCase() }}</span>
        </AvatarImage>
      </div>

      <div class="qq-thread-copy">
        <div class="qq-thread-head">
          <strong>{{ row.displayTitle }}</strong>
          <div class="qq-thread-head-meta">
            <span v-if="row.isMuted" class="qq-thread-muted-dot" title="消息免打扰">静音</span>
            <span class="qq-thread-time">{{ formatTime(row.updatedAt || row.lastMessage?.createdAt) }}</span>
          </div>
        </div>

        <p class="qq-thread-subtitle">{{ row.kind === "group" ? "群聊" : "单聊" }}</p>
        <div class="qq-thread-preview-row">
          <p class="qq-thread-preview">{{ row.preview }}</p>
          <span v-if="row.unreadMentionCount" class="badge mention-badge">@{{ row.unreadMentionCount }}</span>
          <span v-else-if="row.unreadCount" class="badge">{{ row.unreadCount }}</span>
        </div>
      </div>

      <div class="qq-thread-actions">
        <button
          class="qq-thread-action-btn"
          type="button"
          :title="row.isMuted ? '取消免打扰' : '消息免打扰'"
          @click.stop="handleToggleMute(row)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5.23v13.54a1 1 0 0 1-1.6.8L8.67 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3.67l3.73-2.57a1 1 0 0 1 1.6.8ZM19 9l-1.41 1.41L19.17 12l-1.58 1.59L19 15l1.41-1.41L18.83 12l1.58-1.59L19 9Z"/></svg>
        </button>
        <button
          class="qq-thread-action-btn"
          type="button"
          :title="row.pinnedAt ? '取消置顶' : '置顶会话'"
          @click.stop="handleTogglePin(row)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 4 6 6-2 2-2-2-3 3v6l-2 1v-7L8 10l2-2 2 2 3-3-2-2 1-1Z"/></svg>
        </button>
        <button
          v-if="desktop"
          class="qq-thread-action-btn"
          type="button"
          title="打开独立窗口"
          @click.stop="$emit('open', row.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h8v2H7v10h10v-6h2v8H5V5Zm8 0h6v6h-2V8.41l-6.29 6.3-1.42-1.42L15.59 7H13V5Z"/></svg>
        </button>
      </div>

      <span v-if="row.pinnedAt" class="conversation-pin-dot" aria-hidden="true"></span>
    </article>

    <ConversationContextMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      :pinned="Boolean(menuRow?.pinnedAt)"
      :muted="Boolean(menuRow?.isMuted)"
      :desktop="desktop"
      @close="closeMenu"
      @toggle-pin="handleTogglePin(menuRow)"
      @mark-read="handleMarkRead"
      @toggle-mute="handleToggleMute(menuRow)"
      @hide-conversation="handleHideConversation"
      @open-window="menuRow && $emit('open', menuRow.id); closeMenu()"
      @copy-title="handleCopyTitle"
    />
  </div>
</template>
