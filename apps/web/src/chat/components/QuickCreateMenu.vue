<script setup>
defineProps({
  open: { type: Boolean, default: false },
});

defineEmits(["direct", "group"]);
</script>

<template>
  <div v-if="open" class="qq-quick-create-menu">
    <button class="qq-quick-create-item" type="button" @click="$emit('direct')">
      <span class="qq-quick-create-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm0 2c-4.42 0-8 2.24-8 5v1h10.5v-2H6.2c.67-1.16 2.73-2 5.8-2c.93 0 1.77.08 2.52.22v-2.04A13.9 13.9 0 0 0 12 14Zm6 0v-3h-2v3h-3v2h3v3h2v-3h3v-2h-3Z"/></svg>
      </span>
      <span class="qq-quick-create-copy">
        <strong>添加好友</strong>
        <small>查找用户并发送新的好友申请</small>
      </span>
    </button>

    <button class="qq-quick-create-item" type="button" @click="$emit('group')">
      <span class="qq-quick-create-icon is-group" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M8 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Zm8 1a3 3 0 1 0 0-6a3 3 0 0 0 0 6ZM3 19c0-2.78 2.9-5 6.5-5S16 16.22 16 19v1H3v-1Zm12.26 1H21v-.8c0-2.08-2.14-3.7-4.82-3.7c-.69 0-1.34.1-1.94.28c.63.73 1.02 1.6 1.02 2.56V20Z"/></svg>
      </span>
      <span class="qq-quick-create-copy">
        <strong>创建群聊</strong>
        <small>选择多位成员并新建群会话</small>
      </span>
    </button>
  </div>
</template>
