<script setup>
defineProps({
  open: { type: Boolean, default: false },
  update: { type: Object, default: () => ({}) },
});

defineEmits(["update-now", "remind-later", "close"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop update-prompt-backdrop" @click.self="$emit('remind-later')">
    <section class="update-prompt-card">
      <header class="update-prompt-header">
        <div>
          <p class="muted">Linksee Chat</p>
          <h2>发现新版本 {{ update.latestVersion }}</h2>
        </div>
        <span v-if="update.mandatory" class="update-required-badge">重要更新</span>
      </header>

      <p class="update-prompt-copy">
        {{ update.mandatory ? "当前版本需要更新后继续获得完整体验。" : "可以现在更新，也可以稍后再提醒。" }}
      </p>

      <div class="update-prompt-actions">
        <button v-if="!update.mandatory" class="ghost-btn" type="button" @click="$emit('remind-later')">
          稍后提醒
        </button>
        <button class="secondary-btn" type="button" @click="$emit('close')">
          先不处理
        </button>
        <button class="primary-btn" type="button" @click="$emit('update-now')">
          立即更新
        </button>
      </div>
    </section>
  </div>
</template>
