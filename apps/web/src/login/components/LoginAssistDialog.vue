<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  message: { type: String, default: "" },
});

defineEmits(["close"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card confirm-dialog-card">
      <div class="dialog-head">
        <h3>{{ title }}</h3>
      </div>
      <p class="muted">{{ message }}</p>
      <footer class="dialog-actions">
        <button class="primary-btn" type="button" @click="$emit('close')">知道了</button>
      </footer>
    </section>
  </div>
</template>
