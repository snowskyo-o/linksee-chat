<script setup>
defineProps({
  title: { type: String, required: true },
  message: { type: String, default: "" },
  actionText: { type: String, default: "" },
});

defineEmits(["action"]);
</script>

<template>
  <div class="state-panel">
    <strong>{{ title }}</strong>
    <p v-if="message">{{ message }}</p>
    <button v-if="actionText" class="ghost-btn compact-btn" type="button" @click="$emit('action')">
      {{ actionText }}
    </button>
  </div>
</template>
