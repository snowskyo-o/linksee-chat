<script setup>
const props = defineProps({
  file: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
});

const emit = defineEmits(["download", "open-file", "open-file-location", "save-as"]);

function handleFileClick() {
  if (props.file?.transfer?.status === "saved" && props.file?.transfer?.path) {
    emit("open-file", props.file);
    return;
  }
  emit("download", props.file);
}
</script>

<template>
  <button
    class="message-file-card"
    :class="{ 'is-me': isMe, expired: file.expired, 'is-downloading': file.transfer?.status === 'downloading' }"
    type="button"
    :disabled="file.expired || file.transfer?.status === 'downloading'"
    @click="handleFileClick"
  >
    <div class="message-file-copy">
      <strong>{{ file.name }}</strong>
      <small>
        {{ file.metaText || file.sizeText }}
        <template v-if="file.transfer?.status === 'downloading'"> · {{ file.transfer.progress || 0 }}%</template>
        <template v-else-if="file.transfer?.status === 'saved'"> · 已保存</template>
        <template v-else-if="file.transfer?.status === 'failed'"> · 下载失败</template>
      </small>
      <div class="message-file-actions">
        <span class="message-inline-action" @click.stop="handleFileClick">
          {{ file.transfer?.status === "saved" ? "打开" : "下载" }}
        </span>
        <span class="message-inline-action" @click.stop="$emit('save-as', file)">另存为</span>
        <span
          v-if="file.transfer?.status === 'saved' && file.transfer?.path"
          class="message-inline-action"
          @click.stop="$emit('open-file-location', file)"
        >
          位置
        </span>
      </div>
    </div>
    <div class="message-file-icon">
      <svg v-if="file.transfer?.status === 'downloading'" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r="14"></circle>
        <path :style="{ strokeDasharray: `${Math.max(2, file.transfer.progress || 0)} 100` }" d="M18 4a14 14 0 1 1 0 28a14 14 0 0 1 0-28Z"></path>
        <text x="18" y="22">{{ file.transfer.progress || 0 }}</text>
      </svg>
      <span v-else>{{ file.extensionLabel }}</span>
    </div>
  </button>
</template>
