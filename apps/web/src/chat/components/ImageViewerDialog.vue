<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: "" },
  src: { type: String, default: "" },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: "" },
});

defineEmits(["close", "download"]);
</script>

<template>
  <div v-if="open" class="dialog-backdrop image-viewer-backdrop" @click.self="$emit('close')">
    <section class="dialog-card image-viewer-dialog">
      <header class="dialog-head">
        <div>
          <h3>{{ title || "图片预览" }}</h3>
          <p class="muted">内置图片查看器</p>
        </div>
        <div class="dialog-actions">
          <button class="ghost-btn compact-btn" type="button" @click="$emit('download')">下载</button>
          <button class="ghost-btn compact-btn" type="button" @click="$emit('close')">关闭</button>
        </div>
      </header>

      <div class="image-viewer-stage">
        <div v-if="loading" class="muted">正在加载图片...</div>
        <div v-else-if="hint" class="hint is-error">{{ hint }}</div>
        <img v-else-if="src" :src="src" :alt="title || 'preview'" class="image-viewer-image" />
        <div v-else class="muted">暂无可预览内容</div>
      </div>
    </section>
  </div>
</template>
