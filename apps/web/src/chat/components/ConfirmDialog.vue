<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "请确认" },
  message: { type: String, default: "确定继续吗？" },
  confirmText: { type: String, default: "确认" },
  submitting: { type: Boolean, default: false },
});

defineEmits(["close", "submit"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card confirm-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>{{ title }}</h3>
          <p class="muted">{{ message }}</p>
        </div>
      </header>

      <footer class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
        <button class="primary-btn" type="button" :disabled="submitting" @click="$emit('submit')">
          {{ submitting ? '处理中...' : confirmText }}
        </button>
      </footer>
    </section>
  </div>
</template>
