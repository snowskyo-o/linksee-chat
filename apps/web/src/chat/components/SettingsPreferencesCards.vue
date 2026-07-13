<script setup>
const props = defineProps({
  appInfo: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  settings: { type: Object, default: () => ({ notifications: {}, general: {}, appearance: {} }) },
});

const emit = defineEmits([
  "open-update",
  "update:desktopPreferences",
  "update:settings",
]);

function patchSettings(section, key, value) {
  emit("update:settings", {
    ...(props.settings || {}),
    [section]: {
      ...(props.settings?.[section] || {}),
      [key]: value,
    },
  });
}

function patchDesktopPreferences(key, value) {
  emit("update:desktopPreferences", {
    ...(props.desktopPreferences || {}),
    [key]: value,
  });
}
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
      <input :checked="Boolean(settings?.notifications?.desktopEnabled)" type="checkbox" @change="patchSettings('notifications', 'desktopEnabled', $event.target.checked)" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>提示音</strong>
        <p class="muted">收到新消息时播放内置双音提示，不支持时回退为系统提示音。</p>
      </div>
      <input :checked="Boolean(settings?.notifications?.soundEnabled)" type="checkbox" @change="patchSettings('notifications', 'soundEnabled', $event.target.checked)" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>消息免打扰</strong>
        <p class="muted">同步托盘菜单状态，开启后不再弹系统通知。</p>
      </div>
      <input :checked="Boolean(desktopPreferences?.notificationsMuted)" type="checkbox" @change="patchDesktopPreferences('notificationsMuted', $event.target.checked)" />
    </label>
  </section>

  <section class="settings-card">
    <div class="detail-card-head">
      <h3>常用设置</h3>
    </div>
    <div class="settings-field-group">
      <span>发送快捷键</span>
      <div class="settings-choice-row">
        <label class="settings-choice">
          <input :checked="(settings?.general?.sendShortcut || 'enter') === 'enter'" type="radio" name="send-shortcut" @change="patchSettings('general', 'sendShortcut', 'enter')" />
          <span>Enter 发送</span>
        </label>
        <label class="settings-choice">
          <input :checked="(settings?.general?.sendShortcut || 'enter') === 'ctrlEnter'" type="radio" name="send-shortcut" @change="patchSettings('general', 'sendShortcut', 'ctrlEnter')" />
          <span>Ctrl+Enter 发送</span>
        </label>
      </div>
    </div>
    <label class="settings-toggle">
      <div>
        <strong>关闭窗口时最小化到托盘</strong>
        <p class="muted">保持桌面端常驻，类似常见聊天软件。</p>
      </div>
      <input :checked="desktopPreferences?.closeToTray !== false" type="checkbox" @change="patchDesktopPreferences('closeToTray', $event.target.checked)" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>外部打开链接</strong>
        <p class="muted">默认用系统浏览器打开外部网页。</p>
      </div>
      <input :checked="Boolean(settings?.general?.openLinksExternally)" type="checkbox" @change="patchSettings('general', 'openLinksExternally', $event.target.checked)" />
    </label>
    <label class="settings-toggle">
      <div>
        <strong>开机启动</strong>
        <p class="muted">系统登录后自动启动桌面客户端。</p>
      </div>
      <input :checked="Boolean(desktopPreferences?.launchOnStartup)" type="checkbox" @change="patchDesktopPreferences('launchOnStartup', $event.target.checked)" />
    </label>
  </section>

  <section class="settings-card">
    <div class="detail-card-head">
      <h3>外观</h3>
    </div>
    <div class="settings-field-group">
      <span>主题模式</span>
      <div class="settings-choice-row">
        <label class="settings-choice">
          <input :checked="(settings?.appearance?.themeMode || 'system') === 'light'" type="radio" name="theme-mode" @change="patchSettings('appearance', 'themeMode', 'light')" />
          <span>浅色模式</span>
        </label>
        <label class="settings-choice">
          <input :checked="(settings?.appearance?.themeMode || 'system') === 'dark'" type="radio" name="theme-mode" @change="patchSettings('appearance', 'themeMode', 'dark')" />
          <span>深色模式</span>
        </label>
        <label class="settings-choice">
          <input :checked="(settings?.appearance?.themeMode || 'system') === 'system'" type="radio" name="theme-mode" @change="patchSettings('appearance', 'themeMode', 'system')" />
          <span>跟随系统</span>
        </label>
      </div>
    </div>
  </section>

  <section class="settings-card">
    <div class="detail-card-head">
      <h3>软件信息</h3>
    </div>
    <div class="settings-meta-list">
      <div class="settings-meta-row"><span>产品名</span><strong>{{ appInfo.productName || "Linksee Chat" }}</strong></div>
      <div class="settings-meta-row"><span>版本号</span><strong>{{ appInfo.version || "-" }}</strong></div>
      <div v-if="appInfo.update?.hasUpdate" class="settings-update-card" :class="{ 'is-required': appInfo.update?.mandatory }">
        <div>
          <strong>发现新版本 {{ appInfo.update.latestVersion }}</strong>
          <p class="muted">{{ appInfo.update.mandatory ? "当前版本需要尽快更新" : "可在方便时更新客户端" }}</p>
        </div>
        <button class="secondary-btn compact-btn" type="button" @click="$emit('open-update')">立即更新</button>
      </div>
      <div v-else class="settings-meta-row"><span>更新状态</span><strong>已是最新</strong></div>
      <div class="settings-meta-row"><span>Electron</span><strong>{{ appInfo.electron || "-" }}</strong></div>
      <div class="settings-meta-row"><span>Chromium</span><strong>{{ appInfo.chrome || "-" }}</strong></div>
      <div class="settings-meta-row"><span>Node.js</span><strong>{{ appInfo.node || "-" }}</strong></div>
    </div>
  </section>
</template>
