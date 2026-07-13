<script setup>
defineProps({
  desktopPreferences: { type: Object, default: () => ({}) },
  settings: { type: Object, default: () => ({ notifications: {} }) },
});

defineEmits(["update:desktopPreferences", "update:settings"]);
</script>

<template>
  <section class="settings-card">
    <div class="detail-card-head">
      <h3>通知与声音</h3>
    </div>
    <label class="settings-toggle">
      <div>
        <strong>桌面消息提醒</strong>
        <p class="muted">收到新消息时显示系统通知小窗。</p>
      </div>
      <input :checked="Boolean(settings?.notifications?.desktopEnabled)" type="checkbox" @change="$emit('update:settings', ['notifications', 'desktopEnabled', $event.target.checked])" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>提示音</strong>
        <p class="muted">收到新消息时播放内置双音提示，不支持时回退为系统提示音。</p>
      </div>
      <input :checked="Boolean(settings?.notifications?.soundEnabled)" type="checkbox" @change="$emit('update:settings', ['notifications', 'soundEnabled', $event.target.checked])" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>消息免打扰</strong>
        <p class="muted">同步托盘菜单状态，开启后不再弹系统通知。</p>
      </div>
      <input :checked="Boolean(desktopPreferences?.notificationsMuted)" type="checkbox" @change="$emit('update:desktopPreferences', ['notificationsMuted', $event.target.checked])" />
    </label>
  </section>
</template>
