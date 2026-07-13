<script setup>
defineProps({
  appInfo: { type: Object, default: () => ({}) },
});

defineEmits(["open-update"]);
</script>

<template>
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
