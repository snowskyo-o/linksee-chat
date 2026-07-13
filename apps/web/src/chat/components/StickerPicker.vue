<script setup>
defineProps({
  open: { type: Boolean, default: false },
  stickers: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  hint: { type: String, default: "" },
  hintTone: { type: String, default: "" },
  desktopMode: { type: Boolean, default: false },
});

defineEmits(["pick", "import-files"]);
</script>

<template>
  <div v-if="open" class="emoji-picker sticker-picker">
    <section class="emoji-picker-group">
      <header class="emoji-picker-group-title sticker-picker-head">
        <span>表情包</span>
        <div v-if="desktopMode" class="sticker-picker-actions">
          <button class="ghost-btn compact-btn" type="button" @click="$emit('import-files')">管理导入</button>
        </div>
      </header>

      <div v-if="hint" class="hint" :class="hintTone === 'error' ? 'is-error' : 'is-success'">{{ hint }}</div>
      <div v-if="loading" class="muted">正在读取本地表情...</div>
      <div v-else-if="stickers.length" class="sticker-grid">
        <button
          v-for="sticker in stickers"
          :key="sticker.id"
          class="sticker-card"
          type="button"
          :title="sticker.name"
          @click="$emit('pick', sticker)"
        >
          <img :src="sticker.src" :alt="sticker.name" />
          <span class="sticker-card-label">{{ sticker.name }}</span>
        </button>
      </div>
      <div v-else class="muted">
        {{ desktopMode ? "先导入一些本地图片作为表情包。" : "桌面端可导入本地表情包。" }}
      </div>
    </section>
  </div>
</template>
