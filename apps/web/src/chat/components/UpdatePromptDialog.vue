<script setup>
defineProps({
  open: { type: Boolean, default: false },
  update: { type: Object, default: () => ({}) },
});

defineEmits(["update-now", "remind-later", "close"]);

const statusText = {
  checking: "正在检查更新",
  available: "新版本已就绪",
  downloading: "正在下载更新",
  downloaded: "更新已下载",
  installing: "正在准备安装",
  error: "更新失败",
};
</script>

<template>
  <div v-if="open" class="dialog-backdrop update-prompt-backdrop" @click.self="$emit('remind-later')">
    <section class="update-prompt-card">
      <header class="update-prompt-header">
        <div>
          <p class="muted">Linksee Chat</p>
          <h2>{{ statusText[update.status] || "发现新版本" }} {{ update.latestVersion || "" }}</h2>
        </div>
        <span v-if="update.mandatory" class="update-required-badge">重要更新</span>
      </header>

      <p class="update-prompt-copy">
        {{ update.error || (update.downloaded ? "安装后会自动重启并回到当前账号。" : update.mandatory ? "当前版本需要更新后继续获得完整体验。" : "可以现在更新，也可以稍后再提醒。") }}
      </p>

      <div v-if="update.status === 'downloading'" class="update-progress">
        <div class="update-progress-track">
          <span :style="{ width: `${Math.max(0, Math.min(100, Number(update.progress || 0)))}%` }"></span>
        </div>
        <strong>{{ Math.round(Number(update.progress || 0)) }}%</strong>
      </div>

      <div class="update-prompt-actions">
        <button v-if="!update.mandatory && update.status !== 'downloading' && update.status !== 'installing'" class="ghost-btn" type="button" @click="$emit('remind-later')">
          稍后提醒
        </button>
        <button class="secondary-btn" type="button" :disabled="update.status === 'installing'" @click="$emit('close')">
          先不处理
        </button>
        <button class="primary-btn" type="button" :disabled="update.status === 'checking' || update.status === 'downloading' || update.status === 'installing'" @click="$emit('update-now')">
          {{ update.downloaded ? "安装并重启" : update.status === "downloading" ? "下载中" : "立即更新" }}
        </button>
      </div>
    </section>
  </div>
</template>
