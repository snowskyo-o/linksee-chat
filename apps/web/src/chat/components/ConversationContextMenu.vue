<script setup>
defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  pinned: { type: Boolean, default: false },
  muted: { type: Boolean, default: false },
  desktop: { type: Boolean, default: false },
});

defineEmits(["toggle-pin", "mark-read", "toggle-mute", "hide-conversation", "open-window", "copy-title", "close"]);
</script>

<template>
  <div v-if="open" class="qq-thread-context-layer" @click="$emit('close')">
    <div class="qq-thread-context-menu" :style="{ left: `${x}px`, top: `${y}px` }" @click.stop>
      <button class="qq-thread-context-item" type="button" @click="$emit('toggle-pin')">
        <span>{{ pinned ? "取消置顶" : "置顶会话" }}</span>
      </button>
      <button v-if="desktop" class="qq-thread-context-item" type="button" @click="$emit('open-window')">
        <span>打开独立窗口</span>
      </button>
      <button class="qq-thread-context-item" type="button" @click="$emit('mark-read')">
        <span>标记已读</span>
      </button>
      <button class="qq-thread-context-item" type="button" @click="$emit('toggle-mute')">
        <span>{{ muted ? "取消免打扰" : "消息免打扰" }}</span>
      </button>
      <button class="qq-thread-context-item is-danger" type="button" @click="$emit('hide-conversation')">
        <span>从列表隐藏</span>
      </button>
      <button class="qq-thread-context-item" type="button" @click="$emit('copy-title')">
        <span>复制会话名称</span>
      </button>
    </div>
  </div>
</template>
