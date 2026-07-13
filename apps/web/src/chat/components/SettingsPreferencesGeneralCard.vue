<script setup>
defineProps({
  desktopPreferences: { type: Object, default: () => ({}) },
  settings: { type: Object, default: () => ({ general: {} }) },
});

defineEmits(["update:desktopPreferences", "update:settings"]);
</script>

<template>
  <section class="settings-card">
    <div class="detail-card-head">
      <h3>常用设置</h3>
    </div>
    <div class="settings-field-group">
      <span>发送快捷键</span>
      <div class="settings-choice-row">
        <label class="settings-choice">
          <input :checked="(settings?.general?.sendShortcut || 'enter') === 'enter'" type="radio" name="send-shortcut" @change="$emit('update:settings', ['general', 'sendShortcut', 'enter'])" />
          <span>Enter 发送</span>
        </label>
        <label class="settings-choice">
          <input :checked="(settings?.general?.sendShortcut || 'enter') === 'ctrlEnter'" type="radio" name="send-shortcut" @change="$emit('update:settings', ['general', 'sendShortcut', 'ctrlEnter'])" />
          <span>Ctrl+Enter 发送</span>
        </label>
      </div>
    </div>
    <label class="settings-toggle">
      <div>
        <strong>关闭窗口时最小化到托盘</strong>
        <p class="muted">保持桌面端常驻，类似常见聊天软件。</p>
      </div>
      <input :checked="desktopPreferences?.closeToTray !== false" type="checkbox" @change="$emit('update:desktopPreferences', ['closeToTray', $event.target.checked])" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>外部打开链接</strong>
        <p class="muted">默认用系统浏览器打开外部网页。</p>
      </div>
      <input :checked="Boolean(settings?.general?.openLinksExternally)" type="checkbox" @change="$emit('update:settings', ['general', 'openLinksExternally', $event.target.checked])" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>开机启动</strong>
        <p class="muted">系统登录后自动启动桌面客户端。</p>
      </div>
      <input :checked="Boolean(desktopPreferences?.launchOnStartup)" type="checkbox" @change="$emit('update:desktopPreferences', ['launchOnStartup', $event.target.checked])" />
    </label>
  </section>
</template>
