<script setup>
defineProps({
  standaloneMode: { type: Boolean, default: false },
});
</script>

<template>
  <aside class="chat-detail-panel" :class="{ 'is-standalone': standaloneMode }">
    <section class="detail-card qq-side-card detail-card-blank" :class="{ 'is-standalone': standaloneMode }">
      <div class="detail-card-head">
        <h3>信息面板预留</h3>
      </div>
      <div class="detail-card-blank-body">
        <p class="muted">右侧区域先保留为空白面板。</p>
        <p class="muted">个人资料、通知偏好和软件信息已迁移到设置界面统一管理。</p>
      </div>
    </section>
  </aside>
</template>
