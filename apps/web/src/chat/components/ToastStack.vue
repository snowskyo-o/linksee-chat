<script setup>
defineProps({
  notifications: { type: Array, default: () => [] },
});

defineEmits(["dismiss"]);
</script>

<template>
  <div v-if="notifications.length" class="toast-stack">
    <article
      v-for="item in notifications"
      :key="item.id"
      class="toast-card"
      :class="item.tone ? `is-${item.tone}` : ''"
    >
      <div class="toast-copy">
        <strong>{{ item.title }}</strong>
        <p>{{ item.message }}</p>
      </div>
      <button class="toast-close" type="button" @click="$emit('dismiss', item.id)">×</button>
    </article>
  </div>
</template>
