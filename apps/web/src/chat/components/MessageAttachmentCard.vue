<script setup>
import { onBeforeUnmount, ref, watch } from "vue";
import { chatApi } from "../../shared/api-client.js";

const props = defineProps({
  file: { type: Object, required: true },
  isMe: { type: Boolean, default: false },
});

const emit = defineEmits(["download", "open-image", "open-file"]);

function handleFileClick() {
  if (props.file?.transfer?.status === "saved" && props.file?.transfer?.path) {
    emit("open-file", props.file);
    return;
  }
  emit("download", props.file);
}

const imageSrc = ref("");
const imageLoading = ref(false);

function revokeImageSrc() {
  if (imageSrc.value?.startsWith("blob:")) URL.revokeObjectURL(imageSrc.value);
  imageSrc.value = "";
}

async function loadImagePreview() {
  revokeImageSrc();
  if (!props.file?.isImage || !props.file?.objectKey || props.file?.expired) return;
  imageLoading.value = true;
  try {
    const blob = await chatApi.getBlob(`/api/v1/chat/files/download?objectKey=${encodeURIComponent(props.file.objectKey)}`);
    imageSrc.value = URL.createObjectURL(blob);
  } catch {
    imageSrc.value = "";
  } finally {
    imageLoading.value = false;
  }
}

watch(() => props.file?.objectKey, loadImagePreview, { immediate: true });
onBeforeUnmount(revokeImageSrc);
</script>

<template>
  <button
    v-if="file.isImage"
    class="message-image-card"
    :class="{ 'is-me': isMe, expired: file.expired }"
    type="button"
    :disabled="file.expired"
    @click="$emit('open-image', file)"
  >
    <img v-if="imageSrc" :src="imageSrc" :alt="file.name" />
    <span v-else class="message-image-placeholder">{{ imageLoading ? "加载中" : "图片" }}</span>
  </button>

  <button
    v-else
    class="message-file-card"
    :class="{ 'is-me': isMe, expired: file.expired, 'is-downloading': file.transfer?.status === 'downloading' }"
    type="button"
    :disabled="file.expired || file.transfer?.status === 'downloading'"
    @click="handleFileClick"
  >
    <div class="message-file-copy">
      <strong>{{ file.name }}</strong>
      <small>
        {{ file.sizeText }}
        <template v-if="file.transfer?.status === 'downloading'"> · {{ file.transfer.progress || 0 }}%</template>
        <template v-else-if="file.transfer?.status === 'saved'"> · 已保存</template>
        <template v-else-if="file.transfer?.status === 'failed'"> · 下载失败</template>
      </small>
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
