<script setup>
const props = defineProps({
  appInfo: { type: Object, default: () => ({}) },
  desktopPreferences: { type: Object, default: () => ({}) },
  settings: { type: Object, default: () => ({ files: {} }) },
});

const emit = defineEmits([
  "choose-download-dir",
  "clear-cache",
  "open-download-dir",
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
</script>

<template>
  <section class="settings-card">
    <div class="detail-card-head">
      <h3>文件与图片</h3>
    </div>
    <label class="settings-toggle">
      <div>
        <strong>自动接收图片</strong>
        <p class="muted">桌面端会将当前已加载聊天中的图片静默保存到本地，便于离线查看和打开位置。</p>
      </div>
      <input :checked="Boolean(settings?.files?.autoReceiveImages)" type="checkbox" @change="patchSettings('files', 'autoReceiveImages', $event.target.checked)" />
    </label>
  </section>

  <section class="settings-card">
    <div class="detail-card-head">
      <h3>本地数据目录</h3>
    </div>
    <div class="settings-meta-list">
      <div class="settings-meta-row settings-meta-row-wrap">
        <span>下载保存位置</span>
        <strong>{{ desktopPreferences?.downloadsDir || appInfo.storage?.exports || "-" }}</strong>
      </div>
      <div class="settings-inline-actions">
        <button class="secondary-btn compact-btn" type="button" @click="$emit('choose-download-dir')">更换目录</button>
        <button class="ghost-btn compact-btn" type="button" @click="$emit('open-download-dir')">打开目录</button>
      </div>
      <div class="settings-meta-row"><span>根目录</span><strong>{{ appInfo.storage?.root || "-" }}</strong></div>
      <div class="settings-meta-row"><span>表情包目录</span><strong>{{ appInfo.storage?.stickers || "-" }}</strong></div>
      <div class="settings-meta-row"><span>头像缓存</span><strong>{{ appInfo.storage?.avatars || "-" }}</strong></div>
      <div class="settings-meta-row"><span>聊天缓存</span><strong>{{ appInfo.storage?.chatCache || "-" }}</strong></div>
      <div class="settings-meta-row"><span>导出目录</span><strong>{{ appInfo.storage?.exports || "-" }}</strong></div>
      <div class="settings-inline-actions">
        <button class="ghost-btn compact-btn" type="button" @click="$emit('clear-cache')">清理缓存</button>
      </div>
    </div>
  </section>
</template>
