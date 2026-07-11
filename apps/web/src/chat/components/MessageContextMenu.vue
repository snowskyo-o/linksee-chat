<script setup>
defineProps({
  open: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  items: { type: Array, default: () => [] },
});

defineEmits(["select"]);
</script>

<template>
  <div
    v-if="open"
    class="message-context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <button
      v-for="item in items"
      :key="item.key"
      class="message-context-item"
      :class="{ danger: item.tone === 'danger' }"
      type="button"
      @click="$emit('select', item)"
    >
      <span>{{ item.label }}</span>
      <small v-if="item.meta">{{ item.meta }}</small>
    </button>
  </div>
</template>
