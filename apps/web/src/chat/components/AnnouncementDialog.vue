<script setup>
defineProps({
  open: { type: Boolean, default: false },
  draft: { type: String, default: "" },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  submitting: { type: Boolean, default: false },
});

defineEmits(["close", "submit", "update:draft"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="$emit('close')">
    <section class="dialog-card announcement-dialog-card">
      <header class="dialog-head">
        <div>
          <h3>发布公告</h3>
          <p class="muted">公告会在当前会话顶部以特殊消息形式展示</p>
        </div>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
      </header>

      <label class="field field-quiet">
        <span>公告内容</span>
        <textarea
          :value="draft"
          rows="6"
          placeholder="输入要通知会话成员的内容"
          @input="$emit('update:draft', $event.target.value)"
        ></textarea>
      </label>

      <div class="hint" :class="hint ? (hintTone === 'error' ? 'is-error' : 'is-success') : ''">{{ hint }}</div>

      <footer class="dialog-actions">
        <button class="ghost-btn" type="button" @click="$emit('close')">取消</button>
        <button class="primary-btn" type="button" :disabled="submitting" @click="$emit('submit')">
          {{ submitting ? '发布中...' : '发布公告' }}
        </button>
      </footer>
    </section>
  </div>
</template>
