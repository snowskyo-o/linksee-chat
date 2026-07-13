<script setup>
import MessageContextMenu from "./MessageContextMenu.vue";

defineProps({
  contextMenuItems: { type: Array, default: () => [] },
  dragActive: { type: Boolean, default: false },
  messageMenu: { type: Object, default: () => ({ open: false, x: 0, y: 0 }) },
});

defineEmits(["select-context"]);
</script>

<template>
  <MessageContextMenu
    :open="messageMenu.open"
    :x="messageMenu.x"
    :y="messageMenu.y"
    :items="contextMenuItems"
    @select="$emit('select-context', $event)"
  />

  <div v-if="dragActive" class="chat-drop-overlay">
    <div class="chat-drop-card chat-drop-card-quiet">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M10 10h12l4 5h12a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Zm14 10-8 8h5v7h6v-7h5l-8-8Z"/>
      </svg>
    </div>
  </div>
</template>
