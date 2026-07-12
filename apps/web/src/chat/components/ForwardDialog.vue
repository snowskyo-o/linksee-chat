<script setup>
defineProps({
  open: { type: Boolean, default: false },
  conversations: { type: Array, default: () => [] },
  selectedId: { type: String, default: "" },
  hint: { type: String, default: "" },
  submitting: { type: Boolean, default: false },
});

defineEmits(["close", "submit", "update:selectedId"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card forward-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>转发消息</h3>
          <p class="muted">选择一个目标会话，发送后会作为新的消息投递。</p>
        </div>
      </header>

      <div class="forward-dialog-list">
        <label
          v-for="item in conversations"
          :key="item.id"
          class="forward-dialog-item"
          :class="{ 'is-active': item.id === selectedId }"
        >
          <input
            :checked="item.id === selectedId"
            type="radio"
            name="forward-target"
            @change="$emit('update:selectedId', item.id)"
          />
          <div class="forward-dialog-copy">
            <strong>{{ item.displayTitle }}</strong>
            <p class="muted">{{ item.displaySubtitle }}</p>
          </div>
        </label>
      </div>

      <div v-if="hint" class="hint is-error">{{ hint }}</div>

      <footer class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
        <button class="primary-btn" type="button" :disabled="submitting" @click="$emit('submit')">
          {{ submitting ? "转发中..." : "确认转发" }}
        </button>
      </footer>
    </section>
  </div>
</template>
