<script setup>
import ConversationContextMenu from "./ConversationContextMenu.vue";
import ConversationThreadListItem from "./ConversationThreadListItem.vue";
import StatePanel from "./StatePanel.vue";
import { useConversationThreadMenu } from "../composables/useConversationThreadMenu.js";

defineProps({
  rows: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
  formatTime: { type: Function, required: true },
  desktop: { type: Boolean, default: false },
  keyword: { type: String, default: "" },
  loadState: { type: Object, default: () => ({ status: "idle", message: "" }) },
});

const emit = defineEmits(["select", "open", "toggle-pin", "mark-read", "toggle-mute", "hide-conversation", "copy-title", "retry-load"]);
const {
  closeMenu,
  handleCopyTitle,
  handleHideConversation,
  handleMarkRead,
  handleToggleMute,
  handleTogglePin,
  menuOpen,
  menuRow,
  menuX,
  menuY,
  openMenu,
} = useConversationThreadMenu(emit);
</script>

<template>
  <div class="qq-thread-list" @mouseleave="closeMenu">
    <StatePanel
      v-if="!rows.length && loadState?.status === 'error'"
      title="加载失败，请重试"
      :message="loadState?.message || '暂时无法获取会话列表'"
      action-text="重新加载"
      @action="$emit('retry-load')"
    />
    <StatePanel
      v-else-if="!rows.length"
      :title="keyword ? '没有匹配的会话' : '暂无会话'"
      :message="keyword ? '试试更换搜索词。' : '选择一个联系人开始聊天'"
    />
    <ConversationThreadListItem
      v-for="row in rows"
      :key="row.id"
      :desktop="desktop"
      :format-time="formatTime"
      :row="row"
      :selected-id="selectedId"
      @select="$emit('select', $event)"
      @open="$emit('open', $event)"
      @toggle-mute="handleToggleMute($event)"
      @toggle-pin="handleTogglePin($event)"
      @contextmenu.prevent="openMenu($event, row)"
    />

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
