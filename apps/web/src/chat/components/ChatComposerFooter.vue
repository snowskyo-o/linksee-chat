<script setup>
defineProps({
  composerHint: { type: String, default: "" },
  composerHintTone: { type: String, default: "" },
});

defineEmits(["clear"]);
</script>

<template>
  <div class="composer-row">
    <div class="hint" :class="composerHint ? (composerHintTone === 'error' ? 'is-error' : 'is-success') : ''">
      {{ composerHint }}
    </div>
    <div class="composer-send-group">
      <button class="ghost-btn composer-quiet-btn" type="button" @click="$emit('clear')">清空</button>
      <button class="primary-btn composer-send-btn" type="submit">发送</button>
    </div>
  </div>
</template>
