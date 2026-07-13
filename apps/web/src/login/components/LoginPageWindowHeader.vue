<script setup>
defineProps({
  isDesktop: { type: Boolean, default: false },
  shell: { type: Object, required: true },
});
</script>

<template>
  <header class="compact-auth-header">
    <div class="compact-auth-drag">
      <span class="compact-auth-logo">L</span>
      <div class="compact-auth-brand">
        <strong>Linksee Chat</strong>
        <span>桌面聊天客户端</span>
      </div>
    </div>

    <div v-if="isDesktop" class="compact-auth-window-actions">
      <button class="compact-auth-window-btn compact-auth-window-btn-light" type="button" aria-label="最小化" @click="shell.minimizeWindow">─</button>
      <button class="compact-auth-window-btn compact-auth-window-btn-light is-close" type="button" aria-label="关闭" @click="shell.closeWindow">×</button>
    </div>
  </header>
</template>
