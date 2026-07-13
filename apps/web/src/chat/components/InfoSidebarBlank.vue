<template>
  <section class="detail-card qq-side-card detail-card-blank" :class="{ 'is-standalone': standaloneMode }">
    <div class="detail-card-head">
      <h3>资料面板</h3>
    </div>
    <div class="detail-card-blank-body">
      <p class="muted">选择一个联系人或群聊后，这里会显示资料和成员信息。</p>
    </div>
  </section>
</template>

<script setup>
defineProps({
  standaloneMode: { type: Boolean, default: false },
});
</script>
